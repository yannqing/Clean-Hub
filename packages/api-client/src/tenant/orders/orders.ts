import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantOrderListQuery,
  TenantOrderListResponse,
  TenantOrderOverview,
  TenantOrderOverviewQuery,
} from "./orders.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantOrdersApi(client: ApiClient) {
  return {
    list: (query?: TenantOrderListQuery, options?: RequestOptions) =>
      client.get<TenantOrderListResponse>("/tenant/orders", {
        query,
        ...options,
      }),
    overview: (query?: TenantOrderOverviewQuery, options?: RequestOptions) =>
      client.get<TenantOrderOverview>("/tenant/orders/overview", {
        query,
        ...options,
      }),
  };
}
