import type { ReportSummary } from "../types";

export async function getReportSummaryQuery(): Promise<ReportSummary> {
  return {
    grossSales: 0,
    orderCount: 0,
  };
}
