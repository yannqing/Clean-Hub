import type { ApiClient, QueryParams } from "../types";
import type { ReportSummary } from "./reports.types";

export function createTenantReportsApi(client: ApiClient) {
  return {
    getSummary: (query?: QueryParams) =>
      client.get<ReportSummary>("/tenant/reports/summary", { query }),
  };
}
