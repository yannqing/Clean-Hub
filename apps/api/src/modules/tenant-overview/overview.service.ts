import { getDb, type Database } from "@cleanhub/db";

import { AuthError } from "../auth/auth.errors.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../auth/permission.helper.js";
import { findTenantOverviewBase } from "./overview.repository.js";
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
    throw new AuthError(
      "FEATURE_DISABLED",
      "Tenant overview requires active tenant feature flags.",
    );
  }

  return {
    ...overview,
    todayOrderCount: 0,
    todayRevenueAmount: 0,
    pendingPickupCount: 0,
    inProgressOrderCount: 0,
    pendingTasksCount: 0,
  };
}
