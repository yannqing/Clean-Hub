import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosCustomerStatistics,
  PosOrderStatisticsDetail,
  PosStatisticsOverview,
  PosStatisticsQuery,
  PosTicketStatisticsDetail,
} from "./statistics.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

const BASE = "/pos/statistics";

export function createPosStatisticsApi(client: ApiClient) {
  return {
    getOverview: (query?: PosStatisticsQuery, options?: RequestOptions) =>
      client.get<PosStatisticsOverview>(`${BASE}/overview`, {
        query,
        ...options,
      }),

    getTicketStatistics: (query?: PosStatisticsQuery, options?: RequestOptions) =>
      client.get<PosTicketStatisticsDetail>(`${BASE}/tickets`, {
        query,
        ...options,
      }),

    getOrderStatistics: (query?: PosStatisticsQuery, options?: RequestOptions) =>
      client.get<PosOrderStatisticsDetail>(`${BASE}/orders`, {
        query,
        ...options,
      }),

    getCustomerStatistics: (
      query?: { branchId?: string },
      options?: RequestOptions,
    ) =>
      client.get<PosCustomerStatistics>(`${BASE}/customers`, {
        query,
        ...options,
      }),
  };
}
