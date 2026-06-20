import type { ApiClient } from "../types";
import type {
  CreatePosOrderRequest,
  PosOrderDetail,
  PosOrderListQuery,
  PosOrderListResponse,
} from "./orders.types";

export function createPosOrdersApi(client: ApiClient) {
  return {
    list: (query?: PosOrderListQuery) =>
      client.get<PosOrderListResponse>("/pos/orders", { query }),
    get: (orderId: string) =>
      client.get<PosOrderDetail>(`/pos/orders/${orderId}`),
    create: (input: CreatePosOrderRequest) =>
      client.post<PosOrderDetail>("/pos/orders", input),
  };
}
