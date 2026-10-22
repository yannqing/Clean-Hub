import assert from "node:assert/strict";
import "../../config/env.js";

import { createId } from "@cleanhub/id";
import { closeDbConnection, createDbConnection, getDatabaseUrl, getDb, platformTaxTemplates,
  runWithTenantDatabaseContext, tenants } from "@cleanhub/db";
import { resolvePosTaxReadiness } from "./pos-tax-readiness.js";

const originalUrl = getDatabaseUrl();
const url = new URL(originalUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error("Readiness RLS integration is limited to loopback databases.");
}
const admin = createDbConnection({ databaseUrl: originalUrl });
const role = `readiness_rls_${createId().toLowerCase()}`;
const password = createId();
let created = false;
try {
  await closeDbConnection();
  await admin.pool.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
  created = true;
  await admin.pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await admin.pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${role}`);
  url.username = role;
  url.password = password;
  process.env.DATABASE_URL = url.toString();
  process.env.DATABASE_POOL_MAX = "4";
  await runWithTenantDatabaseContext("01KRERJN800000000000000001", async () => {
    const db = getDb();
    assert.equal((await db.select().from(platformTaxTemplates)).length, 0,
      "tenant requests cannot directly read the SaaS template table");
    const result = await resolvePosTaxReadiness(db, "01KRERJN800000000000000001", "01KRERJN8G0000000000000040");
    assert.equal(result.ready, true, JSON.stringify(result));
    const visibleTenants = await db.select({ id: tenants.id }).from(tenants);
    assert.deepEqual(visibleTenants.map((tenant) => tenant.id), ["01KRERJN800000000000000001"],
      "the template lookup must restore the caller's tenant isolation");
    assert.equal((await resolvePosTaxReadiness(db, "01KRERJN810000000000000002")).code, "POS_TAX_COUNTRY_REQUIRED",
      "global template access must not expose another tenant's business data");
  });
  console.log("Tax readiness with restricted RLS role passed; tenant isolation preserved.");
} finally {
  await closeDbConnection();
  process.env.DATABASE_URL = originalUrl;
  if (created) {
    await admin.pool.query(`DROP OWNED BY ${role}`);
    await admin.pool.query(`DROP ROLE ${role}`);
  }
  await admin.pool.end();
}
