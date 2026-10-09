import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantOrderCommentRequest,
  CreateTenantOrderItemRequest,
  CreateTenantOrderPaymentRequest,
  CreateTenantOrderPaymentCorrectionRequest,
  CreateTenantOrderRefundRequest,
  ChangeTenantOrderStatusRequest,
  DeleteTenantOrderItemRequest,
  DeleteTenantOrderCommentRequest,
  TenantOrderDetail,
  TenantOrderAttachmentUploadRequest,
  TenantOrderAttachmentUploadTicket,
  TenantOrderImportRequest,
  TenantOrderImportResponse,
  TenantOrderListQuery,
  TenantOrderListResponse,
  TenantOrderOverview,
  TenantOrderOverviewQuery,
  TenantOrderTimelineItem,
  TenantOrderTimelineQuery,
  TenantOrderTimelineResponse,
  UpdateTenantOrderCommentRequest,
  UpdateTenantOrderItemRequest,
} from "./orders.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantOrdersApi(client: ApiClient) {
  return {
    list: (query?: TenantOrderListQuery, options?: RequestOptions) =>
      client.get<TenantOrderListResponse>("/tenant/orders", {
        query,
        ...options,
      }),
    get: (orderId: string, options?: RequestOptions) =>
      client.get<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}`,
        options,
      ),
    timeline: (
      orderId: string,
      query?: TenantOrderTimelineQuery,
      options?: RequestOptions,
    ) =>
      client.get<TenantOrderTimelineResponse>(
        `/tenant/orders/${encodeURIComponent(orderId)}/timeline`,
        { query, ...options },
      ),
    createComment: (
      orderId: string,
      input: CreateTenantOrderCommentRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderTimelineItem>(
        `/tenant/orders/${encodeURIComponent(orderId)}/comments`,
        input,
        options,
      ),
    requestAttachmentUpload: (
      input: TenantOrderAttachmentUploadRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderAttachmentUploadTicket>(
        "/tenant/orders/media/uploads",
        input,
        options,
      ),
    updateComment: (
      orderId: string,
      commentId: string,
      input: UpdateTenantOrderCommentRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantOrderTimelineItem>(
        `/tenant/orders/${encodeURIComponent(orderId)}/comments/${encodeURIComponent(commentId)}`,
        input,
        options,
      ),
    deleteComment: (
      orderId: string,
      commentId: string,
      input: DeleteTenantOrderCommentRequest,
      options?: RequestOptions,
    ) =>
      client.delete<void>(
        `/tenant/orders/${encodeURIComponent(orderId)}/comments/${encodeURIComponent(commentId)}`,
        { ...options, body: input, parseAs: "void" },
      ),
    changeStatus: (
      orderId: string,
      input: ChangeTenantOrderStatusRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/status-changes`,
        input,
        options,
      ),
    createPayment: (
      orderId: string,
      input: CreateTenantOrderPaymentRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/payments`,
        input,
        options,
      ),
    createItem: (
      orderId: string,
      input: CreateTenantOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/items`,
        input,
        options,
      ),
    updateItem: (
      orderId: string,
      itemId: string,
      input: UpdateTenantOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
        input,
        options,
      ),
    deleteItem: (
      orderId: string,
      itemId: string,
      input: DeleteTenantOrderItemRequest,
      options?: RequestOptions,
    ) =>
      client.delete<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`,
        { ...options, body: input },
      ),
    createRefund: (
      orderId: string,
      input: CreateTenantOrderRefundRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/payment-adjustments/refunds`,
        input,
        { ...options, idempotencyKey: input.idempotencyKey },
      ),
    createPaymentCorrection: (
      orderId: string,
      input: CreateTenantOrderPaymentCorrectionRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantOrderDetail>(
        `/tenant/orders/${encodeURIComponent(orderId)}/payment-adjustments/corrections`,
        input,
        { ...options, idempotencyKey: input.idempotencyKey },
      ),
    importOrders: (input: TenantOrderImportRequest, options?: RequestOptions) =>
      client.post<TenantOrderImportResponse>(
        "/tenant/orders/import",
        input,
        options,
      ),
    overview: (query?: TenantOrderOverviewQuery, options?: RequestOptions) =>
      client.get<TenantOrderOverview>("/tenant/orders/overview", {
        query,
        ...options,
      }),
  };
}
