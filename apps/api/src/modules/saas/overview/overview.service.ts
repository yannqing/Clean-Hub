import { getDb, type Database } from "@cleanhub/db";

import { requireSaasRole } from "../../auth/permission.helper.js";
import { findPlatformSettings } from "../platform-settings/platform-settings.repository.js";
import {
  findBranchCount,
  findTodoCounts,
  findTenantCounts,
  findTodayOrderCount,
  findTodayRevenueByCurrency,
} from "./overview.repository.js";
import type { GetSaasOverviewInput, SaasOverview } from "./overview.types.js";

export async function getSaasOverview(
  input: GetSaasOverviewInput,
  db: Database = getDb(),
): Promise<SaasOverview> {
  requireSaasRole(input.authContext, ["super_admin", "support"]);
  const configuredTimezone =
    (await findPlatformSettings(db))?.timezone ?? "UTC";
  let timezone = configuredTimezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: configuredTimezone });
  } catch {
    timezone = "UTC";
  }

  const [
    tenantCounts,
    todoCounts,
    branchCount,
    todayOrderCount,
    todayRevenueByCurrency,
  ] = await Promise.all([
    findTenantCounts(db),
    findTodoCounts(db),
    findBranchCount(db),
    findTodayOrderCount(db, timezone),
    findTodayRevenueByCurrency(db, timezone),
  ]);

  return {
    tenantCount: tenantCounts.total,
    activeTenantCount: tenantCounts.active,
    suspendedTenantCount: tenantCounts.suspended,
    branchCount,
    todayOrderCount,
    todayRevenueByCurrency,
    pendingFeedbackCount: todoCounts.feedbackTickets,
    todoCounts,
  };
}
