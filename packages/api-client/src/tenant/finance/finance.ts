import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantFinanceSummary,
  TenantFinanceSummaryQuery,
} from "./finance.types";

type TenantFinanceRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantFinanceApi(client: ApiClient) {
  return {
    getSummary: (
      query?: TenantFinanceSummaryQuery,
      options: TenantFinanceRequestOptions = {},
    ) =>
      client.get<TenantFinanceSummary>("/tenant/finance/summary", {
        ...options,
        query: {
          from: query?.from,
          to: query?.to,
          branchId: query?.branchId,
          currency: query?.currency,
        },
      }),
  };
}
