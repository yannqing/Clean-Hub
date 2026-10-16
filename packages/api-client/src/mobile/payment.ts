import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileApproveRefundResponse,
  MobileCreateRefundRequest,
  MobilePaymentStatusResponse,
  MobileRefundOrderDetail,
  MobileRefundRequest,
  MobileRefundRequestListQuery,
  MobileRefundRequestListResponse,
  MobileRejectRefundRequest,
} from "./payment.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

/**
 * Customers do not pay through the app: staff collect payment at the counter
 * through the POS. Payment status is readable here; initiating a payment and
 * confirming a mock one are intentionally not exposed.
 */
export function createMobilePaymentApi(client: ApiClient) {
  return {
    getPaymentStatus: (paymentId: string, options?: RequestOptions) =>
      client.get<MobilePaymentStatusResponse>(
        `/mobile/payment/payments/${encodeURIComponent(paymentId)}`,
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
