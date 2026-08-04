import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantCustomerListQuery,
  TenantCustomerListResponse,
} from "./customers.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantCustomersApi(client: ApiClient) {
  return {
    list: (query?: TenantCustomerListQuery, options?: RequestOptions) =>
      client.get<TenantCustomerListResponse>("/tenant/customers", {
        query,
        ...options,
      }),
  };
}
