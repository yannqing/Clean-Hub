import { createHash } from "node:crypto";
import { access, chmod, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

type SqliteStatement = {
  all(...values: unknown[]): unknown[];
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): unknown;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

type SqliteDatabaseConstructor = new (fileName: string) => SqliteDatabase;

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: SqliteDatabaseConstructor;
};

const allowedStorageKeyPattern = /^cleanhub(?:\.|:)/;
const defaultMaxValueBytes = 5 * 1024 * 1024;
const maxIndexBytes = 1024 * 1024;

/** Legacy v1 file index retained only for automatic migration. */
export const desktopOfflineStorageIndexFileName = "key-index.v1.json";
export const desktopOfflineStorageDatabaseFileName = "offline-storage.v2.sqlite";

type OfflineStorageIndex = {
  version: 1;
  keys: string[];
};

type SqliteValueRow = { value: string };
type SqliteKeyRow = { key: string };

export type DesktopOfflineStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

function validateOfflineStorageKey(key: string): void {
  if (!allowedStorageKeyPattern.test(key)) {
    throw new Error("Invalid offline storage key.");
  }
}

function getLegacyValueFileName(key: string): string {
  return `${createHash("sha256").update(key).digest("hex")}.json`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseIndex(value: string): OfflineStorageIndex | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("keys" in parsed) ||
    !Array.isArray(parsed.keys) ||
    !parsed.keys.every((key) => typeof key === "string")
  ) {
    return null;
  }

  return {
    version: 1,
    keys: [
      ...new Set(parsed.keys.filter((key) => allowedStorageKeyPattern.test(key))),
    ].sort(),
  };
}

function readSqliteValue(database: SqliteDatabase, key: string): string | null {
  const row = database
    .prepare("select value from offline_kv where key = ?")
    .get(key) as SqliteValueRow | undefined;
  return row?.value ?? null;
}

function writeSqliteValue(
  database: SqliteDatabase,
  key: string,
  value: string,
): void {
  database
    .prepare(
      `insert into offline_kv (key, value, updated_at)
       values (?, ?, ?)
       on conflict(key) do update set
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run(key, value, new Date().toISOString());
}

/**
 * Durable POS storage backed by SQLite in WAL mode.
 *
 * Every replacement is one SQLite statement with synchronous=FULL, so sudden
 * process or power loss leaves either the previous value or the complete next
 * value. The v1 hash-file store is copied into SQLite on first use.
 */
export function createDesktopOfflineStorage(
  directory: string,
  options: { maxValueBytes?: number } = {},
): DesktopOfflineStorage {
  const storageDirectory = path.resolve(directory);
  const databasePath = path.join(
    storageDirectory,
    desktopOfflineStorageDatabaseFileName,
  );
  const legacyIndexPath = path.join(
    storageDirectory,
    desktopOfflineStorageIndexFileName,
  );
  const maxValueBytes = options.maxValueBytes ?? defaultMaxValueBytes;

  require("node:fs").mkdirSync(storageDirectory, {
    recursive: true,
    mode: 0o700,
  });
  const database = new DatabaseSync(databasePath);
  database.exec("pragma journal_mode = WAL");
  database.exec("pragma synchronous = FULL");
  database.exec("pragma busy_timeout = 5000");
  database.exec("pragma foreign_keys = ON");
  database.exec(`
    create table if not exists offline_kv (
      key text primary key not null,
      value text not null,
      updated_at text not null
    ) without rowid;
  `);
  void chmod(databasePath, 0o600).catch(() => undefined);

  let migrationPromise: Promise<void> | null = null;

  const readLegacyValue = async (key: string): Promise<string | null> => {
    const filePath = path.join(storageDirectory, getLegacyValueFileName(key));
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile() || metadata.size > maxValueBytes) return null;
      return await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };

  const migrateLegacyStorage = async (): Promise<void> => {
    if (!(await pathExists(legacyIndexPath))) return;
    const metadata = await stat(legacyIndexPath);
    if (!metadata.isFile() || metadata.size > maxIndexBytes) return;
    const index = parseIndex(await readFile(legacyIndexPath, "utf8"));
    if (!index) return;

    for (const key of index.keys) {
      if (readSqliteValue(database, key) !== null) continue;
      const value = await readLegacyValue(key);
      if (value !== null) writeSqliteValue(database, key, value);
    }
  };

  const ensureMigrated = (): Promise<void> => {
    migrationPromise ??= migrateLegacyStorage();
    return migrationPromise;
  };

  return {
    async getItem(key) {
      validateOfflineStorageKey(key);
      await ensureMigrated();
      const stored = readSqliteValue(database, key);
      if (stored !== null) return stored;

      // Exact scoped keys remain recoverable even if a legacy index was lost.
      const legacy = await readLegacyValue(key);
      if (legacy !== null) writeSqliteValue(database, key, legacy);
      return legacy;
    },

    async setItem(key, value) {
      validateOfflineStorageKey(key);
      if (Buffer.byteLength(value, "utf8") > maxValueBytes) {
        throw new Error("Offline storage value limit exceeded.");
      }
      await ensureMigrated();
      writeSqliteValue(database, key, value);
    },

    async removeItem(key) {
      validateOfflineStorageKey(key);
      await ensureMigrated();
      database.prepare("delete from offline_kv where key = ?").run(key);
      await rm(path.join(storageDirectory, getLegacyValueFileName(key)), {
        force: true,
      });
    },

    async keys() {
      await ensureMigrated();
      const rows = database
        .prepare("select key from offline_kv order by key")
        .all() as SqliteKeyRow[];
      return rows.map((row) => row.key);
    },
  };
}
