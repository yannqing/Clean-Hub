import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  ChangePosOrderStatusRequest,
  CreatePosOrderItemRequest,
  CreatePosOrderRequest,
  CreatePosPaymentRequest,
  PosOrderDetail,
  PosOrderListQuery,
  PosOrderListResponse,
  PosOrderOverview,
  PosOrderOverviewQuery,
  PosOrderPaymentsResponse,
  UpdatePosOrderItemRequest,
  UpdatePosOrderRequest,
} from "./orders.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosOrdersApi(client: ApiClient) {
  return {
    list: (query?: PosOrderListQuery, options?: RequestOptions) =>
      client.get<PosOrderListResponse>("/pos/orders", { query, ...options }),
    overview: (query?: PosOrderOverviewQuery, options?: RequestOptions) =>
      client.get<PosOrderOverview>("/pos/orders/overview", {
        query,
        ...options,
      }),
    get: (orderId: string, options?: RequestOptions) =>
      client.get<PosOrderDetail>(`/pos/orders/${orderId}`, options),
    create: (input: CreatePosOrderRequest, options?: RequestOptions) =>
      client.post<PosOrderDetail>("/pos/orders", input, options),
    update: (
      orderId: string,
      input: UpdatePosOrderRequest,
      options?: RequestOptions,
    ) => client.patch<PosOrderDetail>(`/pos/orders/${orderId}`, input, options),
    remove: (orderId: string, options?: RequestOptions) =>
      client.delete<void>(`/pos/orders/${orderId}`, {
        parseAs: "void",
        ...options,
      }),
    changeStatus: (
      orderId: string,
      input: ChangePosOrderStatusRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/status-changes`,
        input,
        options,
      ),
    listPayments: (orderId: string, options?: RequestOptions) =>
      client.get<PosOrderPaymentsResponse>(
        `/pos/orders/${orderId}/payments`,
        options,
      ),
    pay: (
      orderId: string,
      input: CreatePosPaymentRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/payments`,
        input,
        options,
      ),
    createItem: (
      orderId: string,
      input: CreatePosOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/items`,
        input,
        options,
      ),
    updateItem: (
      orderId: string,
      itemId: string,
      input: UpdatePosOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.patch<PosOrderDetail>(
        `/pos/orders/${orderId}/items/${itemId}`,
        input,
        options,
      ),
    deleteItem: (orderId: string, itemId: string, options?: RequestOptions) =>
      client.delete<PosOrderDetail>(
        `/pos/orders/${orderId}/items/${itemId}`,
        options,
      ),
  };
}
