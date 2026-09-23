import assert from "node:assert/strict";

import "../../config/env.js";

import { and, eq, sql } from "drizzle-orm";

import {
  branches,
  closeDbConnection,
  customerAccounts,
  customers,
  orders,
  getDb,
  orderItems,
  posChannelSettings,
  prices,
  serviceCategories,
  services,
  tenantFeatureFlags,
  tenants,
  userProfiles,
  users,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../auth/auth.types.js";
import { applyPosOrderFinancialRules } from "../pos/orders/orders.financial.js";
import { createPosOrder } from "../pos/orders/orders.service.js";
import { TenantServicesError } from "../tenant/services/services.errors.js";
import { updateTenantService } from "../tenant/services/services.service.js";
import { TenantTaxRateError } from "../tenant/tax-rates/tax-rates.errors.js";
import {
  createTenantTaxRate,
  deleteTenantTaxRate,
  listTenantTaxRates,
  updateTenantTaxRate,
} from "../tenant/tax-rates/tax-rates.service.js";

/**
 * Per-item tax through the real checkout path against a real database.
 *
 * The pure calculation is covered by @cleanhub/domain tax.smoke.ts. This proves the
 * plumbing around it: each order line picks up its own service's rate from
 * the catalogue, falls back to the tenant default when it has none, and the
 * rate it was taxed at is written onto the line where tax reports read it.
 * Everything runs in one transaction that is rolled back.
 */

class ExpectedRollback extends Error {}

function reuseOuterTransaction(transaction: Database): Database {
  Object.defineProperty(transaction, "transaction", {
    configurable: true,
    value: async (callback: (db: Database) => Promise<unknown>) => callback(transaction),
  });
  return transaction;
}

const ids = {
  tenantId: createId(),
  userId: createId(),
  branchId: createId(),
  categoryId: createId(),
  standardServiceId: createId(),
  exemptServiceId: createId(),
  defaultServiceId: createId(),
  customerAccountId: createId(),
  customerId: createId(),
  orderId: createId(),
};

const owner: AuthContext = {
  userId: ids.userId,
  displayName: "Tax integration owner",
  tenantId: ids.tenantId,
  branchIds: [],
  role: "owner",
  roles: ["owner"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

/**
 * Run an operation that is expected to fail at the database, inside a
 * savepoint. Without it a rejected statement aborts the whole outer test
 * transaction and every later assertion fails for the wrong reason.
 */
async function expectRejectedInSavepoint(
  db: Database,
  operation: () => Promise<unknown>,
  matches: (error: unknown) => boolean,
): Promise<void> {
  await db.execute(sql`savepoint expected_failure`);
  await assert.rejects(operation(), matches);
  await db.execute(sql`rollback to savepoint expected_failure`);
}

async function insertFixtures(db: Database): Promise<void> {
  const suffix = ids.tenantId.toLowerCase();
  await db.insert(tenants).values({
    id: ids.tenantId,
    name: "Tax integration tenant",
    pressingCode: `TAX-${suffix}`,
    status: "active",
  });
  await db.insert(tenantFeatureFlags).values({
    id: createId(),
    tenantId: ids.tenantId,
    laundryEnabled: true,
  });
  await db.insert(users).values({
    id: ids.userId,
    tenantId: ids.tenantId,
    userType: "tenant",
    email: `${suffix}@tax.integration.cleanhub.local`,
    normalizedEmail: `${suffix}@tax.integration.cleanhub.local`,
    passwordHash: "integration-test-only",
    pinHash: "integration-test-only",
    status: "active",
  });
  await db.insert(userProfiles).values({
    userId: ids.userId,
    tenantId: ids.tenantId,
    displayName: "Tax integration owner",
    language: "fr",
    timezone: "Africa/Dakar",
  });
  await db.insert(branches).values({
    id: ids.branchId,
    tenantId: ids.tenantId,
    name: "Dakar branch",
    defaultCurrency: "XOF",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(customerAccounts).values({
    id: ids.customerAccountId,
    tenantId: ids.tenantId,
    accountName: "Hôtel Teranga",
    email: `customer-${suffix}@tax.integration.cleanhub.local`,
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(customers).values({
    id: ids.customerId,
    customerAccountId: ids.customerAccountId,
    tenantId: ids.tenantId,
    fullName: "Hôtel Teranga",
    status: "active",
    createdBy: ids.userId,
  });
  // Senegal: VAT on, 18% by default, shelf prices exclusive of tax.
  await db.insert(posChannelSettings).values({
    id: createId(),
    tenantId: ids.tenantId,
    // Cash drawer tracking needs an open shift on an enrolled terminal; this
    // test is about tax, so it takes cash without a drawer.
    cashTrackingEnabled: false,
    taxEnabled: true,
    defaultTaxRate: "0.1800",
    pricesIncludeTax: false,
    taxRegistrationNumber: "SN-NINEA-TEST",
  });
  await db.insert(serviceCategories).values({
    id: ids.categoryId,
    tenantId: ids.tenantId,
    name: "Pressing",
    businessLine: "laundry",
    status: "active",
    createdBy: ids.userId,
  });
  const service = (id: string, name: string) => ({
    id,
    tenantId: ids.tenantId,
    categoryId: ids.categoryId,
    name,
    businessLine: "laundry" as const,
    pricingUnit: "per_item" as const,
    labelRule: "per_item" as const,
    status: "active" as const,
    createdBy: ids.userId,
  });
  await db.insert(services).values([
    service(ids.standardServiceId, "Chemise"),
    service(ids.exemptServiceId, "Uniforme scolaire"),
    service(ids.defaultServiceId, "Pantalon"),
  ]);
  const price = (serviceId: string, amount: string) => ({
    id: createId(),
    tenantId: ids.tenantId,
    serviceId,
    amount,
    currency: "XOF",
    status: "active" as const,
    createdBy: ids.userId,
  });
  await db.insert(prices).values([
    price(ids.standardServiceId, "10000.00"),
    price(ids.exemptServiceId, "5000.00"),
    price(ids.defaultServiceId, "2000.00"),
  ]);
}

async function runAssertions(db: Database): Promise<void> {
  await insertFixtures(db);
  const meta = { ipAddress: "127.0.0.1", userAgent: "tax-integration" };

  const standard = await createTenantTaxRate(
    { authContext: owner, data: { name: "TVA 18%", rate: "0.1800" }, requestMeta: meta },
    db,
  );
  const exempt = await createTenantTaxRate(
    { authContext: owner, data: { name: "Exonéré", rate: "0.0000" }, requestMeta: meta },
    db,
  );

  // Names are unique per tenant regardless of case: two rates both called
  // "exonéré" would be indistinguishable in the assignment dropdown.
  await expectRejectedInSavepoint(
    db,
    () =>
      createTenantTaxRate(
        { authContext: owner, data: { name: "EXONÉRÉ", rate: "0.0000" }, requestMeta: meta },
        db,
      ),
    (error: unknown) =>
      error instanceof TenantTaxRateError && error.code === "TAX_RATE_NAME_CONFLICT",
  );

  const assigned = await updateTenantService(
    owner,
    ids.standardServiceId,
    { taxRateId: standard.id, version: 1 },
    meta,
    db,
  );
  assert.equal(assigned.taxRateName, "TVA 18%", "the service reports the rate it carries");
  assert.equal(assigned.taxRate, "0.1800");
  await updateTenantService(owner, ids.exemptServiceId, { taxRateId: exempt.id, version: 1 }, meta, db);
  // ids.defaultServiceId carries no rate: it must fall back to the 18% default.

  // A retired rate is not offered for new assignments.
  const retired = await createTenantTaxRate(
    { authContext: owner, data: { name: "Ancien taux", rate: "0.2000" }, requestMeta: meta },
    db,
  );
  await updateTenantTaxRate(
    {
      authContext: owner,
      taxRateId: retired.id,
      data: { archived: true, expectedVersion: retired.version },
      requestMeta: meta,
    },
    db,
  );
  await expectRejectedInSavepoint(
    db,
    () =>
      updateTenantService(owner, ids.defaultServiceId, { taxRateId: retired.id, version: 1 }, meta, db),
    (error: unknown) =>
      error instanceof TenantServicesError && error.code === "SERVICE_TAX_RATE_ARCHIVED",
  );
  // Nor can a service point at a rate id that is not this tenant's.
  await expectRejectedInSavepoint(
    db,
    () =>
      updateTenantService(owner, ids.defaultServiceId, { taxRateId: createId(), version: 1 }, meta, db),
    (error: unknown) =>
      error instanceof TenantServicesError && error.code === "SERVICE_TAX_RATE_NOT_FOUND",
  );

  // 10,000 at 18% + 5,000 exempt + 2,000 at the default 18%, tax-exclusive:
  // tax is 1,800 + 0 + 360 = 2,160; the customer pays 19,160.
  //
  // Priced directly rather than through a cash checkout: taking payment needs
  // an enrolled terminal with an open register, which is not what this proves.
  const created = await createPosOrder(
    {
      authContext: owner,
      data: {
        id: ids.orderId,
        orderType: "manual",
        branchId: ids.branchId,
        customerId: ids.customerId,
        items: [
          { serviceId: ids.standardServiceId, quantity: "1" },
          { serviceId: ids.exemptServiceId, quantity: "1" },
          { serviceId: ids.defaultServiceId, quantity: "1" },
        ],
      },
      requestMeta: meta,
    },
    db,
  );
  const totals = await applyPosOrderFinancialRules(db, {
    authContext: owner,
    tenantId: ids.tenantId,
    orderId: created.id,
    actorUserId: ids.userId,
  });
  assert.deepEqual(
    totals.taxBreakdown.map((entry) => [entry.taxRate, entry.taxMinor]),
    [
      ["0.1800", BigInt(216_000)],
      ["0.0000", BigInt(0)],
    ],
    "tax is filed per rate: 18% on 12,000 and nothing on the exempt 5,000",
  );
  const [order] = await db
    .select({
      taxAmount: orders.taxAmount,
      taxableAmount: orders.taxableAmount,
      totalAmount: orders.totalAmount,
      taxRateSnapshot: orders.taxRateSnapshot,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, ids.tenantId), eq(orders.id, created.id)));
  assert.equal(order?.taxAmount, "2160.00", "1,800 + 0 + 360");
  assert.equal(order?.taxableAmount, "17000.00");
  assert.equal(order?.totalAmount, "19160.00");
  assert.equal(order?.taxRateSnapshot, "0.1800", "the dominant rate");

  const lines = await db
    .select({
      serviceId: orderItems.serviceId,
      taxRateSnapshot: orderItems.taxRateSnapshot,
      taxAmount: orderItems.taxAmount,
      taxableAmount: orderItems.taxableAmount,
    })
    .from(orderItems)
    .where(and(eq(orderItems.tenantId, ids.tenantId), eq(orderItems.orderId, created.id)));
  const byService = new Map(lines.map((line) => [line.serviceId, line]));
  assert.equal(byService.get(ids.standardServiceId)?.taxRateSnapshot, "0.1800");
  assert.equal(byService.get(ids.standardServiceId)?.taxAmount, "1800.00");
  assert.equal(byService.get(ids.exemptServiceId)?.taxRateSnapshot, "0.0000");
  assert.equal(byService.get(ids.exemptServiceId)?.taxAmount, "0.00");
  assert.equal(
    byService.get(ids.defaultServiceId)?.taxRateSnapshot,
    "0.1800",
    "a service with no rate of its own takes the tenant default",
  );
  assert.equal(byService.get(ids.defaultServiceId)?.taxAmount, "360.00");

  // A rate still carried by a service cannot be deleted: that would silently
  // move the service to the default rate. It can be archived instead.
  await expectRejectedInSavepoint(
    db,
    () =>
      deleteTenantTaxRate(
        { authContext: owner, taxRateId: exempt.id, data: null, requestMeta: meta },
        db,
      ),
    (error: unknown) => error instanceof TenantTaxRateError && error.code === "TAX_RATE_IN_USE",
  );

  const listed = await listTenantTaxRates(owner, { includeArchived: false }, db);
  assert.equal(listed.length, 2);
  assert.equal(listed.find((rate) => rate.id === exempt.id)?.serviceCount, 1);
}

export async function runTaxIntegrationTest(): Promise<void> {
  const db = getDb();
  let completed = false;
  try {
    await db.transaction(async (transaction) => {
      await runAssertions(reuseOuterTransaction(transaction as unknown as Database));
      completed = true;
      throw new ExpectedRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }
  assert.equal(completed, true);
  assert.deepEqual(
    await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, ids.tenantId)),
    [],
    "the integration tenant must be rolled back",
  );
}

if (process.argv[1]?.endsWith("tax.integration.ts")) {
  try {
    await runTaxIntegrationTest();
    console.log("Tax integration test passed with a clean rollback.");
  } finally {
    await closeDbConnection();
  }
}
