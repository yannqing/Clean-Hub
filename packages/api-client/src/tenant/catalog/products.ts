import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductOverview,
  TenantProductOverviewQuery,
} from "./products.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantProductsApi(client: ApiClient) {
  return {
    list: (
      query?: TenantProductListQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<TenantProductListResponse>("/tenant/products", {
        query,
        ...options,
      }),
    overview: (
      query?: TenantProductOverviewQuery | QueryParams,
      options?: RequestOptions,
    ) =>
      client.get<TenantProductOverview>("/tenant/products/overview", {
        query,
        ...options,
      }),
  };
}
