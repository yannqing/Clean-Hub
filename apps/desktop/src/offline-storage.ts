import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const offlineStorageKeyPrefix = "cleanhub.pos.offline.";
const defaultMaxValueBytes = 5 * 1024 * 1024;
const maxIndexBytes = 1024 * 1024;

export const desktopOfflineStorageIndexFileName = "key-index.v1.json";

type OfflineStorageIndex = {
  version: 1;
  keys: string[];
};

export type DesktopOfflineStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

class AsyncMutex {
  private tail = Promise.resolve();

  async runExclusive<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.tail = previous.then(
      () => gate,
      () => gate,
    );
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const directoryMutexes = new Map<string, AsyncMutex>();

function getDirectoryMutex(directory: string): AsyncMutex {
  const normalizedDirectory = path.resolve(directory);
  const existing = directoryMutexes.get(normalizedDirectory);
  if (existing) {
    return existing;
  }

  const mutex = new AsyncMutex();
  directoryMutexes.set(normalizedDirectory, mutex);
  return mutex;
}

function validateOfflineStorageKey(key: string): void {
  if (!key.startsWith(offlineStorageKeyPrefix)) {
    throw new Error("Invalid offline storage key.");
  }
}

function getValueFileName(key: string): string {
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

async function writeFileAtomically(
  filePath: string,
  value: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, value, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
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
      ...new Set(
        parsed.keys.filter((key) => key.startsWith(offlineStorageKeyPrefix)),
      ),
    ].sort(),
  };
}

export function createDesktopOfflineStorage(
  directory: string,
  options: { maxValueBytes?: number } = {},
): DesktopOfflineStorage {
  const storageDirectory = path.resolve(directory);
  const indexPath = path.join(
    storageDirectory,
    desktopOfflineStorageIndexFileName,
  );
  const maxValueBytes = options.maxValueBytes ?? defaultMaxValueBytes;
  const mutex = getDirectoryMutex(storageDirectory);

  const getValuePath = (key: string) =>
    path.join(storageDirectory, getValueFileName(key));

  const readIndex = async (): Promise<OfflineStorageIndex | null> => {
    try {
      const metadata = await stat(indexPath);
      if (!metadata.isFile() || metadata.size > maxIndexBytes) {
        return null;
      }
      return parseIndex(await readFile(indexPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1, keys: [] };
      }
      throw error;
    }
  };

  const writeIndex = async (keys: string[]): Promise<void> => {
    const index: OfflineStorageIndex = {
      version: 1,
      keys: [...new Set(keys)].sort(),
    };
    const serializedIndex = JSON.stringify(index);
    if (Buffer.byteLength(serializedIndex, "utf8") > maxIndexBytes) {
      throw new Error("Offline storage key index limit exceeded.");
    }
    await writeFileAtomically(indexPath, serializedIndex);
  };

  return {
    async getItem(key) {
      validateOfflineStorageKey(key);
      return mutex.runExclusive(async () => {
        try {
          return await readFile(getValuePath(key), "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }
          throw error;
        }
      });
    },

    async setItem(key, value) {
      validateOfflineStorageKey(key);
      if (Buffer.byteLength(value, "utf8") > maxValueBytes) {
        throw new Error("Offline queue storage limit exceeded.");
      }

      await mutex.runExclusive(async () => {
        const index = await readIndex();

        // A damaged/missing legacy index cannot be reconstructed from hashed
        // value filenames. Register this known key without guessing other keys.
        const registeredKeys = index?.keys ?? [];
        if (!registeredKeys.includes(key)) {
          await writeIndex([...registeredKeys, key]);
        }
        // Persist the index first. If the process stops between the two atomic
        // renames, enumeration may temporarily see a key without a value and
        // safely omit it. Writing the value first could instead leave durable
        // queue data that can never be enumerated after an epoch change.
        await writeFileAtomically(getValuePath(key), value);
      });
    },

    async removeItem(key) {
      validateOfflineStorageKey(key);
      await mutex.runExclusive(async () => {
        await rm(getValuePath(key), { force: true });
        const index = await readIndex();
        if (index?.keys.includes(key)) {
          await writeIndex(
            index.keys.filter((registeredKey) => registeredKey !== key),
          );
        }
      });
    },

    async keys() {
      return mutex.runExclusive(async () => {
        const index = await readIndex();
        if (!index) {
          return [];
        }

        // Only explicitly indexed application keys are enumerable. Old
        // sha256-only files remain directly readable when their key is known,
        // but there is intentionally no unsafe attempt to reverse those hashes.
        const existingKeys: string[] = [];
        for (const key of index.keys) {
          if (await pathExists(getValuePath(key))) {
            existingKeys.push(key);
          }
        }

        if (existingKeys.length !== index.keys.length) {
          await writeIndex(existingKeys);
        }

        return existingKeys;
      });
    },
  };
}
