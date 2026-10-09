import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantGlobalSearchQuery,
  TenantGlobalSearchResponse,
} from "./search.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantSearchApi(client: ApiClient) {
  return {
    global: (query: TenantGlobalSearchQuery, options?: RequestOptions) =>
      client.get<TenantGlobalSearchResponse>("/tenant/search", {
        query,
        ...options,
      }),
  };
}
