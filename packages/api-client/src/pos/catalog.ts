import type { ApiClient, ApiRequestOptions } from "../types";
import type { TenantItemCatalogResponse } from "../service-item-catalog";
import type { PosCatalogQuery, PosCatalogResponse } from "./catalog.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export function createPosCatalogApi(client: ApiClient) {
  return {
    itemCatalog: (options?: RequestOptions) => client.get<TenantItemCatalogResponse>("/pos/item-catalog", options),
    list: (query: PosCatalogQuery = {}, options?: RequestOptions) =>
      client.get<PosCatalogResponse>("/pos/catalog", { ...options, query }),
  };
}
