import { ZipArchive } from "archiver";
import { sql } from "drizzle-orm";

import { getDb, type Database } from "@cleanhub/db";

import { toCsvDocument } from "./tenant-export.csv.js";

/**
 * Tables excluded from a tenant data export.
 *
 * The export exists so a departing tenant can take their *business* records
 * with them. These tables hold credentials and replay-protection state: handing
 * them over would leak secrets without giving the tenant anything usable.
 *
 * Everything else is included by discovery rather than by a hand-written list,
 * so a new business table is exported automatically. The failure mode is
 * deliberately "exports too much" rather than "silently omits a table nobody
 * remembered to add" — the latter is exactly what breaks a compliance promise.
 */
const EXPORT_EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  "auth_refresh_tokens",
  "customer_auth_otps",
  "customer_auth_refresh_tokens",
  "customer_credentials",
  "mobile_push_tokens",
  "order_discount_idempotency_receipts",
]);

/** Postgres identifiers we generate ourselves; still validated before interpolation. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

type TableRow = Record<string, unknown>;

/**
 * Every public table carrying a `tenant_id`, discovered at runtime.
 *
 * Discovery beats a maintained list: the schema has ~90 tenant-scoped tables
 * and grows, so any static list would rot silently.
 */
export async function listTenantScopedTables(
  db: Database = getDb(),
): Promise<string[]> {
  const result = await db.execute<{ table_name: string }>(sql`
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  `);

  return result.rows
    .map((row) => row.table_name)
    .filter(
      (table) =>
        SAFE_IDENTIFIER.test(table) && !EXPORT_EXCLUDED_TABLES.has(table),
    );
}

async function readTenantRows(
  db: Database,
  table: string,
  tenantId: string,
): Promise<TableRow[]> {
  // `table` comes from information_schema and is re-validated above, so it can
  // never carry caller input. The tenant id stays a bound parameter.
  const result = await db.execute<TableRow>(
    sql`select * from ${sql.identifier(table)} where tenant_id = ${tenantId}`,
  );

  return result.rows;
}

function toCsv(rows: TableRow[]): string {
  if (rows.length === 0) {
    return toCsvDocument([], []);
  }

  const header = Object.keys(rows[0]!);
  return toCsvDocument(
    header,
    rows.map((row) => header.map((column) => row[column])),
  );
}

/**
 * Build a zip archive of the tenant's data, one CSV per table.
 *
 * Returned as bytes rather than written to object storage: an export taken at
 * offboarding should not leave a second copy of the tenant's data sitting in
 * our bucket after they have gone.
 */
export async function buildTenantExportArchive(
  tenantId: string,
  db: Database = getDb(),
): Promise<{ content: Uint8Array; tables: string[] }> {
  const tables = await listTenantScopedTables(db);
  // archiver v8 exports archive classes rather than the older `archiver(...)`
  // factory, so the zip stream is constructed directly.
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  const exported: string[] = [];

  for (const table of tables) {
    const rows = await readTenantRows(db, table, tenantId);

    // Skip empties so the archive shows what the tenant actually had, rather
    // than ~90 header-only files they have to sift through.
    if (rows.length === 0) {
      continue;
    }

    archive.append(toCsv(rows), { name: `${table}.csv` });
    exported.push(table);
  }

  await archive.finalize();
  await finished;

  return { content: Buffer.concat(chunks), tables: exported };
}
