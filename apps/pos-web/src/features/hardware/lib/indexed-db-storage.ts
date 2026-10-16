import type { AsyncKeyValueStorage } from "@cleanhub/offline";

const DATABASE_NAME = "cleanhub-pos-offline";
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = "key-value";

function requestResult<TResult>(
  request: IDBRequest<TResult>,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed.")),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted.")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
      { once: true },
    );
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener(
      "upgradeneeded",
      () => {
        if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          request.result.createObjectStore(OBJECT_STORE_NAME);
        }
      },
      { once: true },
    );
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB could not be opened.")),
      { once: true },
    );
    request.addEventListener(
      "blocked",
      () => reject(new Error("IndexedDB upgrade is blocked by another POS tab.")),
      { once: true },
    );
  });
}

/**
 * IndexedDB is the durable browser/iPad store. localStorage is only a
 * compatibility fallback and migration source for installations created
 * before the IndexedDB store existed.
 */
export function createPosIndexedDbStorage(
  legacyStorage: AsyncKeyValueStorage,
): AsyncKeyValueStorage {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const getDatabase = () => (databasePromise ??= openDatabase());

  const runOrFallback = async <TResult>(
    operation: (database: IDBDatabase) => Promise<TResult>,
    fallback: () => Promise<TResult>,
  ): Promise<TResult> => {
    try {
      return await operation(await getDatabase());
    } catch {
      // Safari private mode, storage pressure, and an interrupted upgrade can
      // make IndexedDB unavailable. Preserve writes in the legacy durable store
      // instead of silently degrading to memory.
      databasePromise = null;
      return fallback();
    }
  };

  const writeIndexedDb = async (
    database: IDBDatabase,
    key: string,
    value: string,
  ): Promise<void> => {
    const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite", {
      durability: "strict",
    });
    transaction.objectStore(OBJECT_STORE_NAME).put(value, key);
    await transactionComplete(transaction);
  };

  return {
    async getItem(key) {
      return runOrFallback(
        async (database) => {
          const transaction = database.transaction(
            OBJECT_STORE_NAME,
            "readonly",
          );
          const value = await requestResult(
            transaction.objectStore(OBJECT_STORE_NAME).get(key),
          );
          if (typeof value === "string") return value;

          const legacyValue = await legacyStorage.getItem(key);
          if (legacyValue !== null) {
            await writeIndexedDb(database, key, legacyValue);
          }
          return legacyValue;
        },
        () => legacyStorage.getItem(key),
      );
    },

    async setItem(key, value) {
      await runOrFallback(
        (database) => writeIndexedDb(database, key, value),
        () => legacyStorage.setItem(key, value),
      );
    },

    async removeItem(key) {
      await runOrFallback(
        async (database) => {
          const transaction = database.transaction(
            OBJECT_STORE_NAME,
            "readwrite",
            { durability: "strict" },
          );
          transaction.objectStore(OBJECT_STORE_NAME).delete(key);
          await transactionComplete(transaction);
          await legacyStorage.removeItem?.(key);
        },
        async () => {
          await legacyStorage.removeItem?.(key);
        },
      );
    },

    async keys() {
      return runOrFallback(
        async (database) => {
          const transaction = database.transaction(
            OBJECT_STORE_NAME,
            "readonly",
          );
          const indexedKeys = await requestResult(
            transaction.objectStore(OBJECT_STORE_NAME).getAllKeys(),
          );
          const legacyKeys = (await legacyStorage.keys?.()) ?? [];
          return [
            ...new Set([
              ...indexedKeys.filter(
                (key): key is string => typeof key === "string",
              ),
              ...legacyKeys,
            ]),
          ];
        },
        async () => (await legacyStorage.keys?.()) ?? [],
      );
    },
  };
}
