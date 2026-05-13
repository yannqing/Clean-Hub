import type { ApiClient, QueryParams } from "../types";
import type { PriceBookSummary } from "./prices.types";

export function createTenantPricesApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<PriceBookSummary[]>("/tenant/prices", { query }),
  };
}
