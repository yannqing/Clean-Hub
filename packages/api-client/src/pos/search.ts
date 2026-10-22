import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  PosGlobalSearchQuery,
  PosGlobalSearchResponse,
} from "./search.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosSearchApi(client: ApiClient) {
  return {
    global: (query: PosGlobalSearchQuery, options?: RequestOptions) =>
      client.get<PosGlobalSearchResponse>("/pos/search", {
        ...options,
        query,
      }),
  };
}
