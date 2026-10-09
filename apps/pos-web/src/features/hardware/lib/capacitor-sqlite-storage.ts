"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { AsyncKeyValueStorage } from "@cleanhub/offline";

const DATABASE_NAME = "cleanhub_pos_offline";
const DATABASE_VERSION = 1;
const MAX_VALUE_BYTES = 2 * 1024 * 1024;

type SqlitePlugin = {
  createConnection(input: {
    database: string;
    version: number;
    encrypted: boolean;
    mode: "no-encryption";
    readonly: boolean;
  }): Promise<void>;
  isDBOpen(input: {
    database: string;
    readonly: boolean;
  }): Promise<{ result: boolean }>;
  open(input: { database: string; readonly: boolean }): Promise<void>;
  execute(input: {
    database: string;
    transaction: boolean;
    statements: string;
  }): Promise<unknown>;
  query(input: {
    database: string;
    statement: string;
    values?: string[];
    readonly: boolean;
  }): Promise<{ values?: Array<Record<string, unknown>> }>;
  run(input: {
    database: string;
    statement: string;
    values: string[];
    transaction: boolean;
    readonly: boolean;
  }): Promise<unknown>;
};

// The Android project owns @capacitor-community/sqlite.  Registering the
// native bridge here avoids bundling that plugin's browser implementation
// (including its web SQLite runtime) into the remotely served POS page.
const CapacitorSQLite = registerPlugin<SqlitePlugin>("CapacitorSQLite");

export type PosNativeSqlitePlugin = SqlitePlugin;

type PosNativeSqliteStorageOptions = {
  plugin?: SqlitePlugin;
  databaseName?: string;
};

function assertStorageKey(key: string): void {
  if (!key || key.length > 500) {
    throw new Error("POS offline storage key is invalid.");
  }
}

function assertStorageValue(value: string): void {
  if (new TextEncoder().encode(value).byteLength > MAX_VALUE_BYTES) {
    throw new Error("POS offline storage value limit exceeded.");
  }
}

function isExistingConnectionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /connection(?:\s+.+)?\s+already exists/i.test(error.message)
  );
}

/** True only for the Android Capacitor POS shell, never a normal browser. */
export function isPosNativeSqliteAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  );
}

/**
 * Android-native durable key/value storage for POS state.
 *
 * The POS queue, cart snapshots and print spool are already scoped and
 * serialized by @cleanhub/offline. Storing those snapshots in SQLite gives the
 * Android shell the same power-loss durability as the Electron POS without
 * changing the replay protocol or its idempotency keys.
 */
export function createPosNativeSqliteStorage(
  options: PosNativeSqliteStorageOptions = {},
): AsyncKeyValueStorage {
  const plugin = options.plugin ?? CapacitorSQLite;
  const database = options.databaseName ?? DATABASE_NAME;
  let ready: Promise<void> | null = null;

  const ensureReady = (): Promise<void> => {
    ready ??= (async () => {
      const alreadyOpen = await plugin
        .isDBOpen({ database, readonly: false })
        .then((result) => result.result)
        .catch(() => false);

      if (!alreadyOpen) {
        try {
          await plugin.createConnection({
            database,
            version: DATABASE_VERSION,
            encrypted: false,
            mode: "no-encryption",
            readonly: false,
          });
        } catch (error) {
          // Capacitor's native connection registry is shared by every
          // webpack chunk. Another POS feature can therefore create this
          // database just before this storage instance does.
          if (!isExistingConnectionError(error)) {
            throw error;
          }
        }

        await plugin.open({ database, readonly: false });
      }
      await plugin.execute({
        database,
        transaction: true,
        statements: `
          CREATE TABLE IF NOT EXISTS offline_kv (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
          ) WITHOUT ROWID;
        `,
      });
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    });

    return ready;
  };

  return {
    async getItem(key) {
      assertStorageKey(key);
      await ensureReady();
      const result = await plugin.query({
        database,
        statement: "SELECT value FROM offline_kv WHERE key = ?",
        values: [key],
        readonly: false,
      });
      const row = result.values?.[0] as { value?: unknown } | undefined;
      return typeof row?.value === "string" ? row.value : null;
    },

    async setItem(key, value) {
      assertStorageKey(key);
      assertStorageValue(value);
      await ensureReady();
      await plugin.run({
        database,
        statement: `
          INSERT INTO offline_kv (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `,
        values: [key, value, new Date().toISOString()],
        transaction: true,
        readonly: false,
      });
    },

    async removeItem(key) {
      assertStorageKey(key);
      await ensureReady();
      await plugin.run({
        database,
        statement: "DELETE FROM offline_kv WHERE key = ?",
        values: [key],
        transaction: true,
        readonly: false,
      });
    },

    async keys() {
      await ensureReady();
      const result = await plugin.query({
        database,
        statement: "SELECT key FROM offline_kv ORDER BY key ASC",
        // The Android plugin requires `values` even when a statement has no
        // placeholders. Supplying an empty array keeps queue-epoch recovery
        // working on native devices.
        values: [],
        readonly: false,
      });
      return (result.values ?? []).flatMap((row) => {
        const key = (row as { key?: unknown }).key;
        return typeof key === "string" ? [key] : [];
      });
    },
  };
}
