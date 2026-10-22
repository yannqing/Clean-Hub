import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type { ReportSummary } from "./reports.types";

type TenantReportRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantReportsApi(client: ApiClient) {
  return {
    getSummary: (
      query?: QueryParams,
      options: TenantReportRequestOptions = {},
    ) =>
      client.get<ReportSummary>("/tenant/reports/summary", {
        ...options,
        query,
      }),
  };
}
