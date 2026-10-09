import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { ReportSummary, ReportSummaryQuery } from "../types";

export async function getReportSummaryQuery(
  query?: ReportSummaryQuery,
): Promise<ReportSummary> {
  return webAdminApi.tenant.reports.getSummary(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
