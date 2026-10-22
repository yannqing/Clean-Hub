import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createDbConnection, getDatabaseUrl } from "../client.js";
import { seedDemoTaxTemplates } from "./dev-tax-templates.js";

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

export async function runDemoSeeds(seedsDir: string, taxTemplatesFile: string): Promise<void> {
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

    await client.query("BEGIN");
    for (const file of SEED_FILES) {
      // The runner owns the transaction, including legacy standalone SQL files.
      const sql = readFileSync(join(seedsDir, file), "utf8").replace(/^(?:BEGIN|COMMIT);\s*$/gm, "");
      await client.query(sql);
      console.log(`Seed applied: ${file}`);
    }

    await seedDemoTaxTemplates(client, taxTemplatesFile);
    await client.query(readFileSync(join(seedsDir, "demo-tax-settings.sql"), "utf8"));
    await client.query("COMMIT");
    console.log("Demo tax settings applied from database templates. TEST tax numbers are for testing only.");
    console.log("Database seeding completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await connection.pool.end();
  }
}

