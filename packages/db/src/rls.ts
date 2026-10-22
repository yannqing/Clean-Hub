import { getDbConnection, type DbConnection } from "./client.js";

export const TENANT_RLS_POLICY_NAME = "cleanhub_tenant_isolation";

export type TenantRlsConfiguration = {
  ready: boolean;
  role: {
    name: string;
    bypassRls: boolean;
    superuser: boolean;
  };
  protectedTableCount: number;
  missingForcedRlsTables: string[];
  missingPolicyTables: string[];
};

type RlsInspectionConnection = Pick<DbConnection, "pool">;

export async function inspectTenantRlsConfiguration(
  connection: RlsInspectionConnection = getDbConnection(),
): Promise<TenantRlsConfiguration> {
  const [roleResult, tableResult] = await Promise.all([
    connection.pool.query<{
      name: string;
      bypass_rls: boolean;
      superuser: boolean;
    }>(`
      select
        rolname as name,
        rolbypassrls as bypass_rls,
        rolsuper as superuser
      from pg_roles
      where rolname = current_user
    `),
    connection.pool.query<{
      table_name: string;
      forced_rls: boolean;
      has_policy: boolean;
    }>(`
      with protected_tables as (
        select c.oid, c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        inner join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('p', 'r')
      )
      select
        protected_tables.table_name,
        protected_tables.relrowsecurity and protected_tables.relforcerowsecurity as forced_rls,
        exists (
          select 1
          from pg_policy
          where pg_policy.polrelid = protected_tables.oid
            and pg_policy.polname = '${TENANT_RLS_POLICY_NAME}'
        ) as has_policy
      from protected_tables
      order by protected_tables.table_name
    `),
  ]);

  const role = roleResult.rows[0];
  if (!role) {
    throw new Error("Unable to inspect the current PostgreSQL role.");
  }

  const missingForcedRlsTables = tableResult.rows
    .filter((row) => !row.forced_rls)
    .map((row) => row.table_name);
  const missingPolicyTables = tableResult.rows
    .filter((row) => !row.has_policy)
    .map((row) => row.table_name);
  const ready =
    !role.superuser &&
    !role.bypass_rls &&
    missingForcedRlsTables.length === 0 &&
    missingPolicyTables.length === 0;

  return {
    ready,
    role: {
      name: role.name,
      bypassRls: role.bypass_rls,
      superuser: role.superuser,
    },
    protectedTableCount: tableResult.rows.length,
    missingForcedRlsTables,
    missingPolicyTables,
  };
}

export async function assertTenantRlsConfiguration(
  connection: RlsInspectionConnection = getDbConnection(),
): Promise<TenantRlsConfiguration> {
  const report = await inspectTenantRlsConfiguration(connection);
  if (report.ready) {
    return report;
  }

  const reasons = [
    report.role.superuser
      ? `database role "${report.role.name}" is a superuser`
      : null,
    report.role.bypassRls
      ? `database role "${report.role.name}" has BYPASSRLS`
      : null,
    report.missingForcedRlsTables.length > 0
      ? `FORCE RLS is missing on: ${report.missingForcedRlsTables.join(", ")}`
      : null,
    report.missingPolicyTables.length > 0
      ? `tenant policy is missing on: ${report.missingPolicyTables.join(", ")}`
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  throw new Error(
    `Tenant RLS configuration is not safe: ${reasons.join("; ")}.`,
  );
}
