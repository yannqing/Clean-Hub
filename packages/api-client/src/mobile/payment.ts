import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileApproveRefundResponse,
  MobileCreatePaymentRequest,
  MobileCreatePaymentResponse,
  MobileCreateRefundRequest,
  MobilePaymentStatusResponse,
  MobilePaymentWebhookResponse,
  MobileRefundOrderDetail,
  MobileRefundRequest,
  MobileRefundRequestListQuery,
  MobileRefundRequestListResponse,
  MobileRejectRefundRequest,
  MobileSimulateMockPaymentRequest,
} from "./payment.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobilePaymentApi(client: ApiClient) {
  return {
    createPayment: (
      orderId: string,
      input: MobileCreatePaymentRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileCreatePaymentResponse>(
        `/mobile/payment/orders/${encodeURIComponent(orderId)}/payments`,
        input,
        options,
      ),
    getPaymentStatus: (paymentId: string, options?: RequestOptions) =>
      client.get<MobilePaymentStatusResponse>(
        `/mobile/payment/payments/${encodeURIComponent(paymentId)}`,
        options,
      ),
    simulateMockPayment: (
      paymentId: string,
      input: MobileSimulateMockPaymentRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobilePaymentWebhookResponse>(
        `/mobile/payment/payments/${encodeURIComponent(paymentId)}/mock-callback`,
        input,
        options,
      ),
    createRefundRequest: (
      orderId: string,
      input: MobileCreateRefundRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileRefundRequest>(
        `/mobile/payment/orders/${encodeURIComponent(orderId)}/refund-requests`,
        input,
        options,
      ),
    listRefundRequests: (
      query?: MobileRefundRequestListQuery,
      options?: RequestOptions,
    ) =>
      client.get<MobileRefundRequestListResponse>(
        "/mobile/payment/refund-requests",
        { ...options, query },
      ),
    getRefundOrderDetail: (
      refundRequestId: string,
      options?: RequestOptions,
    ) =>
      client.get<MobileRefundOrderDetail>(
        `/mobile/payment/refund-requests/${encodeURIComponent(refundRequestId)}/order`,
        options,
      ),
    approveRefundRequest: (
      refundRequestId: string,
      options?: RequestOptions,
    ) =>
      client.post<MobileApproveRefundResponse>(
        `/mobile/payment/refund-requests/${encodeURIComponent(refundRequestId)}/approve`,
        undefined,
        options,
      ),
    rejectRefundRequest: (
      refundRequestId: string,
      input: MobileRejectRefundRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileRefundRequest>(
        `/mobile/payment/refund-requests/${encodeURIComponent(refundRequestId)}/reject`,
        input,
        options,
      ),
  };
}
