import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createId } from "@cleanhub/id";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

import {
  closeDbConnection,
  createDbConnection,
  getDb,
  getDatabaseUrl,
  inspectTenantRlsConfiguration,
  runWithSystemDatabaseContext,
  runWithTenantDatabaseContext,
} from "./index.js";

config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const roleName = `cleanhub_rls_test_${process.pid}`;
const tenantA = createId();
const tenantB = createId();
const accountA = createId();
const accountB = createId();
const ownInsertAccount = createId();
const crossTenantInsertAccount = createId();

type ScopeRow = {
  bypass: string;
  tenant_id: string;
};

async function readApplicationScope(): Promise<ScopeRow> {
  const result = await getDb().execute<ScopeRow>(sql`
    select
      current_setting('app.current_tenant_id', true) as tenant_id,
      current_setting('app.rls_bypass', true) as bypass
  `);
  const row = result.rows[0];
  assert.ok(row);
  return row;
}

async function assertApplicationDatabaseContexts(): Promise<void> {
  const contextAwareDb = getDb();

  const [scopeA, scopeB] = await Promise.all([
    runWithTenantDatabaseContext(tenantA, async () => {
      const result = await contextAwareDb.execute<ScopeRow>(sql`
        select
          current_setting('app.current_tenant_id', true) as tenant_id,
          current_setting('app.rls_bypass', true) as bypass
      `);
      return result.rows[0];
    }),
    runWithTenantDatabaseContext(tenantB, readApplicationScope),
  ]);

  assert.deepEqual(scopeA, { tenant_id: tenantA, bypass: "off" });
  assert.deepEqual(scopeB, { tenant_id: tenantB, bypass: "off" });

  const systemScope = await runWithSystemDatabaseContext(readApplicationScope);
  assert.deepEqual(systemScope, { tenant_id: "", bypass: "on" });
}

async function run(): Promise<void> {
  const connection = createDbConnection({ databaseUrl: getDatabaseUrl() });
  const client = await connection.pool.connect();
  let roleCreated = false;

  try {
    await assertApplicationDatabaseContexts();

    const policyReport = await inspectTenantRlsConfiguration(connection);
    assert.equal(policyReport.missingForcedRlsTables.length, 0);
    assert.equal(policyReport.missingPolicyTables.length, 0);

    await client.query(
      `create role ${roleName} nologin nosuperuser nobypassrls`,
    );
    roleCreated = true;
    await client.query(`grant usage on schema public to ${roleName}`);
    await client.query(
      `grant select, insert, update, delete on all tables in schema public to ${roleName}`,
    );

    await client.query("begin");
    await client.query(
      "insert into tenants (id, name, pressing_code, status) values ($1, 'RLS Tenant A', $2, 'active'), ($3, 'RLS Tenant B', $4, 'active')",
      [tenantA, `RLS-A-${tenantA}`, tenantB, `RLS-B-${tenantB}`],
    );
    await client.query(
      "insert into customer_accounts (id, tenant_id, account_name, status) values ($1, $2, 'Tenant A account', 'active'), ($3, $4, 'Tenant B account', 'active')",
      [accountA, tenantA, accountB, tenantB],
    );

    await client.query(`set local role ${roleName}`);
    await client.query(
      "select set_config('app.current_tenant_id', $1, true), set_config('app.rls_bypass', 'off', true)",
      [tenantA],
    );

    const visibleRows = await client.query<{ id: string }>(
      "select id from customer_accounts where id = any($1::varchar[]) order by id",
      [[accountA, accountB]],
    );
    assert.deepEqual(
      visibleRows.rows.map((row) => row.id),
      [accountA],
    );

    const visibleTenants = await client.query<{ id: string }>(
      "select id from tenants where id = any($1::varchar[]) order by id",
      [[tenantA, tenantB]],
    );
    assert.deepEqual(
      visibleTenants.rows.map((row) => row.id),
      [tenantA],
    );

    const crossTenantUpdate = await client.query<{ id: string }>(
      "update customer_accounts set account_name = 'blocked' where id = $1 returning id",
      [accountB],
    );
    assert.equal(crossTenantUpdate.rowCount, 0);

    const ownInsert = await client.query<{ id: string }>(
      "insert into customer_accounts (id, tenant_id, account_name, status) values ($1, $2, 'Allowed', 'active') returning id",
      [ownInsertAccount, tenantA],
    );
    assert.equal(ownInsert.rows[0]?.id, ownInsertAccount);

    await client.query("savepoint cross_tenant_insert");
    let crossTenantInsertBlocked = false;
    try {
      await client.query(
        "insert into customer_accounts (id, tenant_id, account_name, status) values ($1, $2, 'Blocked', 'active')",
        [crossTenantInsertAccount, tenantB],
      );
    } catch (error) {
      crossTenantInsertBlocked =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "42501";
      await client.query("rollback to savepoint cross_tenant_insert");
    }
    assert.equal(crossTenantInsertBlocked, true);

    await client.query(
      "select set_config('app.current_tenant_id', '', true), set_config('app.rls_bypass', 'on', true)",
    );
    const systemVisibleRows = await client.query<{ id: string }>(
      "select id from customer_accounts where id = any($1::varchar[]) order by id",
      [[accountA, accountB]],
    );
    assert.deepEqual(
      new Set(systemVisibleRows.rows.map((row) => row.id)),
      new Set([accountA, accountB]),
    );

    await client.query("reset role");
    await client.query("rollback");
    console.log("Tenant RLS integration checks passed.");
  } finally {
    await client.query("reset role").catch(() => undefined);
    await client.query("rollback").catch(() => undefined);
    if (roleCreated) {
      await client.query(`drop owned by ${roleName}`).catch(() => undefined);
      await client
        .query(`drop role if exists ${roleName}`)
        .catch(() => undefined);
    }
    client.release();
    await connection.pool.end();
    await closeDbConnection();
  }
}

run().catch((error: unknown) => {
  console.error("Tenant RLS integration checks failed.");
  console.error(error);
  process.exitCode = 1;
});
