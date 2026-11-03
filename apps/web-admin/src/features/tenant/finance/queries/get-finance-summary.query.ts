import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { FinanceSummary, FinanceSummaryQuery } from "../types";

export async function getFinanceSummaryQuery(
  query?: FinanceSummaryQuery,
): Promise<FinanceSummary> {
  return webAdminApi.tenant.finance.getSummary(
    query,
    await getTenantServerApiRequestOptions(),
  );
}
