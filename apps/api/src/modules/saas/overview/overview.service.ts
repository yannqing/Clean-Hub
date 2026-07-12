import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../../auth/permission.helper.js";
import {
  findBranchCount,
  findPendingFeedbackCount,
  findTenantCounts,
  findTodayOrderMetrics,
} from "./overview.repository.js";
import type { GetSaasOverviewInput, SaasOverview } from "./overview.types.js";

export async function getSaasOverview(
  input: GetSaasOverviewInput,
  db: Database = getDb(),
): Promise<SaasOverview> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const [
    tenantCounts,
    pendingFeedbackCount,
    branchCount,
    todayOrderMetrics,
  ] = await Promise.all([
    findTenantCounts(db),
    findPendingFeedbackCount(db),
    findBranchCount(db),
    findTodayOrderMetrics(db),
  ]);

  return {
    tenantCount: tenantCounts.total,
    activeTenantCount: tenantCounts.active,
    suspendedTenantCount: tenantCounts.suspended,
    branchCount,
    todayOrderCount: todayOrderMetrics.orderCount,
    todayRevenueAmount: todayOrderMetrics.revenueAmount,
    pendingFeedbackCount,
  };
}
