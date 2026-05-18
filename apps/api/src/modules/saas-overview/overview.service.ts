import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../auth/permission.helper.js";
import {
  findPendingFeedbackCount,
  findTenantCounts,
} from "./overview.repository.js";
import type { GetSaasOverviewInput, SaasOverview } from "./overview.types.js";

export async function getSaasOverview(
  input: GetSaasOverviewInput,
  db: Database = getDb(),
): Promise<SaasOverview> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);

  const [tenantCounts, pendingFeedbackCount] = await Promise.all([
    findTenantCounts(db),
    findPendingFeedbackCount(db),
  ]);

  return {
    tenantCount: tenantCounts.total,
    activeTenantCount: tenantCounts.active,
    suspendedTenantCount: tenantCounts.suspended,
    // branchCount / todayOrderCount / todayRevenueAmount: Phase 1 tables not yet available
    branchCount: 0,
    todayOrderCount: 0,
    todayRevenueAmount: 0,
    pendingFeedbackCount,
  };
}
