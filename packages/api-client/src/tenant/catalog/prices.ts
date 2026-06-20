import type { ApiClient, QueryParams } from "../../types";
import type {
  PriceListQuery,
  PriceSummary,
  UpdatePriceRequest,
} from "./prices.types";

export function createTenantPricesApi(client: ApiClient) {
  return {
    list: (query?: PriceListQuery | QueryParams) =>
      client.get<PriceSummary[]>("/tenant/prices", { query }),
    update: (priceId: string, data: UpdatePriceRequest) =>
      client.patch<PriceSummary>(`/tenant/prices/${priceId}`, data),
  };
}
