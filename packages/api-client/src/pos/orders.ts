import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  ApplyPosOrderDiscountRequest,
  ChangePosOrderStatusRequest,
  CreatePosCheckoutRequest,
  CreatePosCheckoutResponse,
  CreatePosOrderItemRequest,
  CreatePosOrderRequest,
  CreatePosPaymentRequest,
  CreatePosPaymentResponse,
  DeletePosOrderItemRequest,
  DeletePosOrderRequest,
  PosOrderDetail,
  PosOrderListQuery,
  PosOrderListResponse,
  PosOrderOverview,
  PosOrderOverviewQuery,
  PosOrderPaymentsResponse,
  RemovePosOrderDiscountRequest,
  RecordPosCardPaymentOutcomeRequest,
  ResolvePosPaymentRequest,
  UpdatePosOrderItemRequest,
  UpdatePosOrderRequest,
} from "./orders.types";
import type {
  DeliverPosReceiptRequest,
  PosReceiptDelivery,
} from "./receipts.types";
import type {
  CreatePosProductReturnRequest,
  CreatePosProductReturnResponse,
  PosProductReturnsOverview,
} from "./returns.types";

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
    checkout: (input: CreatePosCheckoutRequest, options?: RequestOptions) =>
      client.post<CreatePosCheckoutResponse>(
        "/pos/orders/checkout",
        input,
        options,
      ),
    update: (
      orderId: string,
      input: UpdatePosOrderRequest,
      options?: RequestOptions,
    ) => client.patch<PosOrderDetail>(`/pos/orders/${orderId}`, input, options),
    remove: (
      orderId: string,
      input: DeletePosOrderRequest,
      options?: RequestOptions,
    ) =>
      client.delete<void>(`/pos/orders/${orderId}`, {
        parseAs: "void",
        body: input,
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
    applyDiscount: (
      orderId: string,
      input: ApplyPosOrderDiscountRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/discounts`,
        input,
        options,
      ),
    removeDiscount: (
      orderId: string,
      applicationId: string,
      input: RemovePosOrderDiscountRequest,
      options?: RequestOptions,
    ) =>
      client.delete<PosOrderDetail>(
        `/pos/orders/${orderId}/discounts/${applicationId}`,
        { body: input, ...options },
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
      client.post<CreatePosPaymentResponse>(
        `/pos/orders/${orderId}/payments`,
        input,
        options,
      ),
    confirmManualPayment: (
      orderId: string,
      paymentId: string,
      input: ResolvePosPaymentRequest = {},
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/payments/${paymentId}/confirm`,
        input,
        options,
      ),
    failManualPayment: (
      orderId: string,
      paymentId: string,
      input: Required<ResolvePosPaymentRequest>,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/payments/${paymentId}/fail`,
        input,
        options,
      ),
    recordCardOutcome: (
      orderId: string,
      paymentId: string,
      input: RecordPosCardPaymentOutcomeRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosOrderDetail>(
        `/pos/orders/${orderId}/payments/${paymentId}/card-outcome`,
        input,
        options,
      ),
    deliverReceipt: (
      orderId: string,
      input: DeliverPosReceiptRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosReceiptDelivery>(
        `/pos/orders/${orderId}/receipt-deliveries`,
        input,
        options,
      ),
    listProductReturns: (orderId: string, options?: RequestOptions) =>
      client.get<PosProductReturnsOverview>(
        `/pos/orders/${orderId}/product-returns`,
        options,
      ),
    createProductReturn: (
      orderId: string,
      input: CreatePosProductReturnRequest,
      options?: RequestOptions,
    ) =>
      client.post<CreatePosProductReturnResponse>(
        `/pos/orders/${orderId}/product-returns`,
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
    deleteItem: (
      orderId: string,
      itemId: string,
      input: DeletePosOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.delete<PosOrderDetail>(`/pos/orders/${orderId}/items/${itemId}`, {
        body: input,
        ...options,
      }),
  };
}
