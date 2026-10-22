import assert from "node:assert/strict";

import { warmUpDbConnection, type WarmUpDbOptions } from "./client.js";

function mockConnection(
  query: () => Promise<unknown>,
): NonNullable<WarmUpDbOptions["connection"]> {
  return { pool: { query } } as unknown as NonNullable<
    WarmUpDbOptions["connection"]
  >;
}

async function succeedsAfterTransientFailures(): Promise<void> {
  let calls = 0;
  const connection = mockConnection(async () => {
    calls += 1;
    if (calls < 3) {
      throw new Error("ECONNRESET");
    }
    return { rows: [] };
  });

  await warmUpDbConnection({
    connection,
    retries: 5,
    delayMs: 0,
    sleep: async () => {},
  });

  assert.equal(calls, 3, "should retry until the probe succeeds");
}

async function rejectsAfterExhaustingRetries(): Promise<void> {
  let calls = 0;
  const connection = mockConnection(async () => {
    calls += 1;
    throw new Error("database unreachable");
  });

  await assert.rejects(
    () =>
      warmUpDbConnection({
        connection,
        retries: 3,
        delayMs: 0,
        sleep: async () => {},
      }),
    /database unreachable/,
  );

  assert.equal(calls, 3, "should attempt exactly the configured retries");
}

async function main(): Promise<void> {
  await succeedsAfterTransientFailures();
  await rejectsAfterExhaustingRetries();
  console.log("db warm-up tests passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
