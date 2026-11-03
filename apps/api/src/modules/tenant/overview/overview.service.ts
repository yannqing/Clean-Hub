import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import { resolveTenantCheckoutReadiness } from "../../tax/tenant-checkout-readiness.repository.js";
import { getDb, type Database } from "@cleanhub/db";

import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { TenantOverviewError } from "./overview.errors.js";
import {
  findTenantInProgressOrderCount,
  findTenantOverviewBase,
  findTenantPendingPickupCount,
  findTenantPendingTasksCount,
  findTenantTodayOrderMetrics,
} from "./overview.repository.js";
import type { TenantOverview, TenantOverviewInput } from "./overview.types.js";

export async function getTenantOverview(
  input: TenantOverviewInput,
  db: Database = getDb(),
): Promise<TenantOverview> {
  requireTenantRole(input.authContext, ["owner", "manager"]);
  await assertActiveTenant(input.authContext, db);

  const tenantId = input.authContext.tenantId!;
  const overview = await findTenantOverviewBase(db, tenantId);

  if (!overview) {
    throw new TenantOverviewError(
      "TENANT_OVERVIEW_NOT_FOUND",
      "Tenant overview is not available for the current tenant.",
      404,
    );
  }

  const allowedBranchIds = await resolveAllowedBranchIds(input.authContext, db);

  const [
    todayOrderMetrics,
    inProgressOrderCount,
    pendingPickupCount,
    pendingTasksCount,
    checkoutReadiness,
  ] = await Promise.all([
    findTenantTodayOrderMetrics(
      db,
      tenantId,
      input.authContext.timezone ?? "UTC",
    ),
    findTenantInProgressOrderCount(db, tenantId),
    findTenantPendingPickupCount(db, tenantId),
    findTenantPendingTasksCount(db, tenantId),
    resolveTenantCheckoutReadiness(db, tenantId, allowedBranchIds),
  ]);

  return {
    ...overview,
    checkoutReadiness,
    todayOrderCount: todayOrderMetrics.orderCount,
    todayRevenueAmount: todayOrderMetrics.revenueAmount,
    pendingPickupCount,
    inProgressOrderCount,
    pendingTasksCount,
  };
}
