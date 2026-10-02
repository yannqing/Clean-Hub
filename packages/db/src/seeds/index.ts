import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { createDbConnection, getDatabaseUrl } from "../client.js";

// Load the repo-root .env the same way drizzle.config.ts does.
config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
});

const SEED_FILES = [
  "dev-accounts.sql",
  "mobile-rbac.sql",
  "pos-cashiers.sql",
  "pos-channel-settings.sql",
  "pos-business-data.sql",
  "discounts.sql",
  "product-category-attributes.sql",
  "notification-defaults.sql",
  "pos-terminal-settings.sql",
  "mobile-e2e.sql",
] as const;

async function runSeeds(): Promise<void> {
  const seedsDir = dirname(fileURLToPath(import.meta.url));
  const databaseUrl = getDatabaseUrl();
  const databaseHost = new URL(databaseUrl).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres", "cleanhub-postgres"]);
  if (
    (process.env.NODE_ENV === "production" || !localHosts.has(databaseHost)) &&
    process.env.CLEANHUB_ALLOW_PRODUCTION_DEMO_SEED !==
      "I_UNDERSTAND_THIS_WRITES_DEMO_DATA"
  ) {
    throw new Error("Demo seed is limited to local databases unless explicitly overridden.");
  }
  const connection = createDbConnection({ databaseUrl });
  const client = await connection.pool.connect();

  try {
    await client.query("select set_config('app.current_tenant_id', '', false)");
    await client.query("select set_config('app.rls_bypass', 'on', false)");

    for (const file of SEED_FILES) {
      const sql = readFileSync(join(seedsDir, file), "utf8");
      await client.query(sql);
      console.log(`Seed applied: ${file}`);
    }

    console.log("Database seeding completed.");
  } finally {
    client.release();
    await connection.pool.end();
  }
}

runSeeds().catch((error: unknown) => {
  console.error("Database seeding failed.");
  console.error(error);
  process.exitCode = 1;
});
