import assert from "node:assert/strict";

import "../../../config/env.js";

import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  auditLogs,
  branches,
  closeDbConnection,
  discountCodes,
  discounts,
  getDb,
  tenants,
  userBranches,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { TenantDiscountsError } from "./discounts.errors.js";
import { findDiscountDetail } from "./discounts.repository.js";
import {
  createTenantDiscount,
  deleteTenantDiscount,
  getTenantDiscountDetail,
  getTenantDiscountOptions,
  getTenantDiscountOverview,
  listTenantDiscounts,
  updateTenantDiscount,
  updateTenantDiscountStatus,
} from "./discounts.service.js";
import type { CreateDiscountRequest } from "./discounts.types.js";

function authContext(
  tenantId: string,
  userId: string,
  role: "owner" | "manager",
): AuthContext {
  return {
    userId,
    displayName: "Discount repository smoke",
    tenantId,
    branchIds: [],
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function automaticOrderDiscount(input: {
  title: string;
  startsAt: string;
  allBranches: boolean;
  branchIds?: string[];
}): CreateDiscountRequest {
  return {
    title: input.title,
    method: "automatic",
    type: "amount_off_order",
    enabled: true,
    code: null,
    valueType: "percentage",
    valueAmount: "10",
    currency: null,
    eligibility: "all_customers",
    minimumRequirement: "none",
    minimumPurchaseAmount: null,
    minimumQuantity: null,
    usageLimit: null,
    oncePerCustomer: false,
    combinesWithItemDiscounts: false,
    combinesWithOrderDiscounts: false,
    combinesWithShippingDiscounts: false,
    startsAt: input.startsAt,
    endsAt: null,
    allBranches: input.allBranches,
    branchIds: input.branchIds ?? [],
    channels: {
      posEnabled: true,
      customerMobileEnabled: false,
      deliveryEnabled: false,
    },
    buyRequirementType: null,
    buyRequirementValue: null,
    getQuantity: null,
    maxUsesPerOrder: null,
    countryScope: "all",
    countryCodes: [],
    maximumShippingPrice: null,
    tags: [],
    targets: [],
    customerIds: [],
  };
}

export async function runTenantDiscountRepositorySmoke(): Promise<void> {
  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.status, "active"), isNull(tenants.deletedAt)))
    .limit(1);
  const tenantId = tenantRows[0]?.id;
  assert.ok(tenantId, "discount smoke requires an active tenant");

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        eq(users.userType, "tenant"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const userId = userRows[0]?.id;
  assert.ok(userId, "discount smoke requires an active tenant user");

  const allowedBranchId = createId();
  const deniedBranchId = createId();
  const discountIds: string[] = [];
  const suffix = createId().slice(-8);
  const owner = authContext(tenantId, userId, "owner");
  const manager = authContext(tenantId, userId, "manager");

  try {
    await db.insert(branches).values([
      {
        id: allowedBranchId,
        tenantId,
        name: `Discount smoke allowed ${suffix}`,
        defaultCurrency: "CNY",
        status: "active",
      },
      {
        id: deniedBranchId,
        tenantId,
        name: `Discount smoke denied ${suffix}`,
        defaultCurrency: "CNY",
        status: "active",
      },
    ]);
    await db.insert(userBranches).values({
      tenantId,
      userId,
      branchId: allowedBranchId,
    });

    const activeStart = new Date(Date.now() - 60_000).toISOString();
    const global = await createTenantDiscount({
      authContext: owner,
      data: {
        ...automaticOrderDiscount({
          title: `Global code ${suffix}`,
          startsAt: activeStart,
          allBranches: true,
        }),
        method: "code",
        code: `SMOKE-${suffix}`,
      },
    });
    discountIds.push(global.id);
    assert.equal(global.status, "active");
    assert.equal(global.canManage, true);

    const codeSearch = await listTenantDiscounts(manager, {
      q: `smoke-${suffix.toLocaleLowerCase()}`,
      sort: "created_desc",
      limit: 10,
      offset: 0,
    });
    assert.ok(codeSearch.data.some((discount) => discount.id === global.id));

    const managerGlobal = await getTenantDiscountDetail(manager, global.id);
    assert.equal(managerGlobal.canManage, false);
    await assert.rejects(
      () =>
        updateTenantDiscountStatus(global.id, {
          authContext: manager,
          data: { enabled: false, version: global.version },
        }),
      (error: unknown) =>
        error instanceof TenantDiscountsError &&
        error.code === "DISCOUNT_FORBIDDEN" &&
        error.status === 403,
    );

    const scheduled = await createTenantDiscount({
      authContext: manager,
      data: automaticOrderDiscount({
        title: `Scoped scheduled ${suffix}`,
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        allBranches: false,
        branchIds: [allowedBranchId],
      }),
    });
    discountIds.push(scheduled.id);
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.canManage, true);
    assert.deepEqual(scheduled.branchIds, [allowedBranchId]);

    const expired = await createTenantDiscount({
      authContext: owner,
      data: {
        ...automaticOrderDiscount({
          title: `Expired ${suffix}`,
          startsAt: new Date(Date.now() - 7_200_000).toISOString(),
          allBranches: true,
        }),
        endsAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
    });
    discountIds.push(expired.id);
    assert.equal(expired.status, "expired");

    await assert.rejects(
      () =>
        createTenantDiscount({
          authContext: manager,
          data: automaticOrderDiscount({
            title: `Denied scope ${suffix}`,
            startsAt: activeStart,
            allBranches: false,
            branchIds: [deniedBranchId],
          }),
        }),
      (error: unknown) =>
        error instanceof TenantDiscountsError &&
        error.code === "DISCOUNT_FORBIDDEN" &&
        error.status === 403,
    );

    await assert.rejects(
      () =>
        createTenantDiscount({
          authContext: owner,
          data: {
            ...automaticOrderDiscount({
              title: `Duplicate code ${suffix}`,
              startsAt: activeStart,
              allBranches: true,
            }),
            method: "code",
            code: ` smoke-${suffix.toLocaleLowerCase()} `,
          },
        }),
      (error: unknown) =>
        error instanceof TenantDiscountsError &&
        error.code === "DISCOUNT_CODE_DUPLICATE" &&
        error.status === 409,
    );

    const scheduledList = await listTenantDiscounts(manager, {
      status: "scheduled",
      sort: "created_desc",
      limit: 10,
      offset: 0,
    });
    assert.ok(
      scheduledList.data.some((discount) => discount.id === scheduled.id),
    );
    assert.ok(
      scheduledList.data.every((discount) => discount.status === "scheduled"),
    );

    await assert.rejects(
      () =>
        listTenantDiscounts(manager, {
          branchId: deniedBranchId,
          sort: "created_desc",
          limit: 10,
          offset: 0,
        }),
      (error: unknown) =>
        error instanceof TenantDiscountsError &&
        error.code === "DISCOUNT_BRANCH_NOT_FOUND" &&
        error.status === 404,
    );

    const options = await getTenantDiscountOptions(manager);
    assert.ok(options.branches.some((branch) => branch.id === allowedBranchId));
    assert.ok(!options.branches.some((branch) => branch.id === deniedBranchId));
    assert.equal(options.canManage, true);
    assert.equal(options.canManageAllBranches, false);

    const fixedAmount = await createTenantDiscount({
      authContext: owner,
      data: {
        ...automaticOrderDiscount({
          title: `Fixed amount ${suffix}`,
          startsAt: activeStart,
          allBranches: true,
        }),
        type: "amount_off_order",
        valueType: "fixed_amount",
        valueAmount: "5.00",
        currency: options.defaultCurrency === "USD" ? "EUR" : "USD",
      },
    });
    discountIds.push(fixedAmount.id);
    assert.equal(
      fixedAmount.currency,
      options.defaultCurrency,
      "fixed discounts must use the tenant default currency",
    );

    const updated = await updateTenantDiscount(scheduled.id, {
      authContext: manager,
      data: {
        title: `Scoped updated ${suffix}`,
        version: scheduled.version,
      },
    });
    assert.equal(updated.title, `Scoped updated ${suffix}`);
    assert.equal(updated.version, scheduled.version + 1);

    await assert.rejects(
      () =>
        updateTenantDiscountStatus(scheduled.id, {
          authContext: manager,
          data: { enabled: false, version: scheduled.version },
        }),
      (error: unknown) =>
        error instanceof TenantDiscountsError &&
        error.code === "DISCOUNT_VERSION_CONFLICT" &&
        error.status === 409,
    );

    const inactive = await updateTenantDiscountStatus(scheduled.id, {
      authContext: manager,
      data: { enabled: false, version: updated.version },
    });
    assert.equal(inactive.status, "inactive");

    const overview = await getTenantDiscountOverview(manager);
    assert.ok(overview.total >= 2);
    assert.ok(overview.active >= 1);
    assert.ok(overview.expired >= 1);
    assert.ok(overview.inactive >= 1);
    assert.ok(overview.totalUses >= 0);

    const wrongTenant = await findDiscountDetail(
      db,
      { tenantId: createId() },
      global.id,
    );
    assert.equal(wrongTenant, null);

    const auditRows = await db
      .select({ eventType: auditLogs.eventType })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantId),
          inArray(auditLogs.entityId, discountIds),
        ),
      );
    assert.ok(
      auditRows.some((audit) => audit.eventType === "discount.created"),
    );
    assert.ok(
      auditRows.some((audit) => audit.eventType === "discount.updated"),
    );
    assert.ok(
      auditRows.some((audit) => audit.eventType === "discount.status_changed"),
    );

    await deleteTenantDiscount(scheduled.id, {
      authContext: manager,
      data: { version: inactive.version },
    });
    const deleted = await findDiscountDetail(
      db,
      { tenantId, allowedBranchIds: [allowedBranchId] },
      scheduled.id,
    );
    assert.equal(deleted, null);

    const activeCodeRows = await db
      .select({ id: discountCodes.id })
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.tenantId, tenantId),
          eq(discountCodes.discountId, global.id),
          isNull(discountCodes.deletedAt),
        ),
      );
    assert.equal(activeCodeRows.length, 1);
  } finally {
    if (discountIds.length > 0) {
      await db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, tenantId),
            inArray(auditLogs.entityId, discountIds),
          ),
        );
      await db
        .delete(discounts)
        .where(
          and(
            eq(discounts.tenantId, tenantId),
            inArray(discounts.id, discountIds),
          ),
        );
    }
    await db
      .delete(userBranches)
      .where(
        and(
          eq(userBranches.userId, userId),
          eq(userBranches.branchId, allowedBranchId),
        ),
      );
    await db
      .delete(branches)
      .where(inArray(branches.id, [allowedBranchId, deniedBranchId]));
  }
}

if (process.argv[1]?.endsWith("discounts.repository.smoke.ts")) {
  try {
    await runTenantDiscountRepositorySmoke();
    console.log("Tenant discounts repository smoke passed.");
  } finally {
    await closeDbConnection();
  }
}
