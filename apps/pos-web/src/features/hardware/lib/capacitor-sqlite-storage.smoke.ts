import {
  createPosNativeSqliteStorage,
  type PosNativeSqlitePlugin,
} from "./capacitor-sqlite-storage";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const values = new Map<string, string>();
let connectionCreated = false;
let opened = false;
let emptyParameterQueryReceivedValues = false;

const plugin = {
  async isConnection() {
    return { result: connectionCreated };
  },
  async createConnection() {
    if (connectionCreated) {
      throw new Error("CreateConnection: Connection already exists");
    }
    connectionCreated = true;
  },
  async isDBOpen() {
    return { result: opened };
  },
  async open() {
    opened = true;
  },
  async execute() {},
  async query(input: { statement?: string; values?: unknown[] }) {
    if (input.statement?.startsWith("SELECT value")) {
      const value = values.get(String(input.values?.[0]));
      return { values: value === undefined ? [] : [{ value }] };
    }
    emptyParameterQueryReceivedValues = Array.isArray(input.values);
    return {
      values: [...values.keys()].sort().map((key) => ({ key })),
    };
  },
  async run(input: { statement?: string; values?: unknown[] }) {
    const key = String(input.values?.[0]);
    if (input.statement?.startsWith("DELETE")) {
      values.delete(key);
    } else {
      values.set(key, String(input.values?.[1]));
    }
    return { changes: { changes: 1 } };
  },
} as unknown as PosNativeSqlitePlugin;

async function main(): Promise<void> {
  const storage = createPosNativeSqliteStorage({
    plugin,
    databaseName: "cleanhub_pos_offline_smoke",
  });
  const listKeys = storage.keys;
  const removeItem = storage.removeItem;

  if (!listKeys || !removeItem) {
    throw new Error("SQLite storage must support key enumeration");
  }

  await storage.setItem("queue-b", "second");
  await storage.setItem("queue-a", "first");
  await storage.setItem("queue-a", "updated");

  assert(connectionCreated && opened, "SQLite storage should open one connection");
  assert(
    (await storage.getItem("queue-a")) === "updated",
    "SQLite storage should persist replacements",
  );
  assert(
    (await listKeys()).join(",") === "queue-a,queue-b",
    "SQLite storage should enumerate ordered keys",
  );
  assert(
    emptyParameterQueryReceivedValues,
    "SQLite storage must pass an empty values array for native key enumeration",
  );

  await removeItem("queue-a");
  assert(
    (await storage.getItem("queue-a")) === null,
    "SQLite storage should remove values",
  );

  // A second feature chunk can construct its own storage adapter after the
  // native plugin has already registered the connection. It must reuse that
  // connection instead of losing its writes.
  opened = false;
  const recoveredStorage = createPosNativeSqliteStorage({
    plugin,
    databaseName: "cleanhub_pos_offline_smoke",
  });
  await recoveredStorage.setItem("recovered", "connection-reused");
  assert(
    (await recoveredStorage.getItem("recovered")) === "connection-reused",
    "SQLite storage should reopen an existing native connection",
  );

  console.log("POS native SQLite storage smoke ok");
}

void main();
