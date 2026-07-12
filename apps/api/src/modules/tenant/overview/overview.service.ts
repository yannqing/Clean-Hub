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

  const [
    todayOrderMetrics,
    inProgressOrderCount,
    pendingPickupCount,
    pendingTasksCount,
  ] = await Promise.all([
    findTenantTodayOrderMetrics(db, tenantId),
    findTenantInProgressOrderCount(db, tenantId),
    findTenantPendingPickupCount(db, tenantId),
    findTenantPendingTasksCount(db, tenantId),
  ]);

  return {
    ...overview,
    todayOrderCount: todayOrderMetrics.orderCount,
    todayRevenueAmount: todayOrderMetrics.revenueAmount,
    pendingPickupCount,
    inProgressOrderCount,
    pendingTasksCount,
  };
}
