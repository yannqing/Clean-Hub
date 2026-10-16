import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createDbConnection, getDatabaseUrl } from "../packages/db/src/client.js";

const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER ?? "./db/drizzle";

type JournalEntry = {
  tag: string;
  breakpoints: boolean;
  when: number;
};

type Journal = {
  entries: JournalEntry[];
};

function readMigrationFiles() {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");

  if (!existsSync(journalPath)) {
    throw new Error(`Can't find ${journalPath}.`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  return journal.entries.map((entry) => {
    const migrationPath = join(migrationsFolder, `${entry.tag}.sql`);

    if (!existsSync(migrationPath)) {
      throw new Error(`Can't find migration file ${migrationPath}.`);
    }

    const query = readFileSync(migrationPath, "utf8");

    return {
      sql: query.split("--> statement-breakpoint"),
      bps: entry.breakpoints,
      folderMillis: entry.when,
      hash: createHash("sha256").update(query).digest("hex"),
    };
  });
}

const connection = createDbConnection({
  databaseUrl: getDatabaseUrl(),
});

try {
  await connection.db.dialect.migrate(readMigrationFiles(), connection.db.session, {
    migrationsFolder,
  });
  console.log(`Database migrations applied from ${migrationsFolder}.`);
} finally {
  await connection.pool.end();
}
