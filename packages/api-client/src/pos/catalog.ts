import type { ApiClient, ApiRequestOptions } from "../types";
import type { PosCatalogQuery, PosCatalogResponse } from "./catalog.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export function createPosCatalogApi(client: ApiClient) {
  return {
    list: (query: PosCatalogQuery = {}, options?: RequestOptions) =>
      client.get<PosCatalogResponse>("/pos/catalog", { ...options, query }),
  };
}
