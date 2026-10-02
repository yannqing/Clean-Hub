import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createDbConnection, getDatabaseUrl } from "../packages/db/src/client.js";

if (
  process.env.NODE_ENV === "production" &&
  process.env.CLEANHUB_ALLOW_PRODUCTION_DEMO_SEED !==
    "I_UNDERSTAND_THIS_WRITES_DEMO_DATA"
) {
  throw new Error(
    "Demo seeds are disabled in production. Set CLEANHUB_ALLOW_PRODUCTION_DEMO_SEED to the documented override only for a disposable environment.",
  );
}

const seedsFolder = process.env.CLEANHUB_SEEDS_FOLDER ?? "./db/seeds";

const seedFiles = [
  "dev-accounts.sql",
  "pos-cashiers.sql",
  "pos-business-data.sql",
  "pos-terminal-settings.sql",
] as const;

const connection = createDbConnection({
  databaseUrl: getDatabaseUrl(),
});

try {
  for (const file of seedFiles) {
    const seedPath = join(seedsFolder, file);

    if (!existsSync(seedPath)) {
      throw new Error(`Can't find seed file ${seedPath}.`);
    }

    await connection.pool.query(readFileSync(seedPath, "utf8"));
    console.log(`Seed applied: ${file}`);
  }

  console.log(`Database seeds applied from ${seedsFolder}.`);
} finally {
  await connection.pool.end();
}
