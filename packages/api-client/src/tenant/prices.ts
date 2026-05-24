import type { ApiClient, QueryParams } from "../types";
import type {
  CreatePriceBookRequest,
  PriceBookListQuery,
  PriceBookSummary,
  UpdatePriceBookRequest,
} from "./prices.types";

export function createTenantPricesApi(client: ApiClient) {
  return {
    list: (query?: PriceBookListQuery | QueryParams) =>
      client.get<PriceBookSummary[]>("/tenant/prices", { query }),
    create: (data: CreatePriceBookRequest) =>
      client.post<PriceBookSummary>("/tenant/prices", data),
    update: (priceBookId: string, data: UpdatePriceBookRequest) =>
      client.patch<PriceBookSummary>(`/tenant/prices/${priceBookId}`, data),
    remove: (priceBookId: string) =>
      client.delete<void>(`/tenant/prices/${priceBookId}`),
  };
}
