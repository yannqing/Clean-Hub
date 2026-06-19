import type { Database } from "@cleanhub/db";

import type { ReportSummary, ReportSummaryInput } from "./reports.types.js";

export async function getTenantReportSummaryRecord(
  _db: Database,
  input: ReportSummaryInput & { tenantId: string },
): Promise<ReportSummary> {
  return {
    grossSales: 0,
    orderCount: 0,
    pendingPickupCount: 0,
    inProgressCount: 0,
    paymentBreakdown: {
      cash: 0,
      mobile: 0,
      card: 0,
      other: 0,
    },
    filters: {
      from: input.from ?? null,
      to: input.to ?? null,
      branchId: input.branchId ?? null,
    },
  };
}
