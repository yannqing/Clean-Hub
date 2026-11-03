import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  CreatePosPaymentAdjustmentResponse,
  CreatePosPaymentCorrectionRequest,
  CreatePosRefundRequest,
  PosPaymentAdjustmentListResponse,
  ResolvePosRefundRequest,
} from "./payment-adjustments.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosPaymentAdjustmentsApi(client: ApiClient) {
  return {
    list: (orderId: string, options?: RequestOptions) =>
      client.get<PosPaymentAdjustmentListResponse>("/pos/payment-adjustments", {
        query: { orderId },
        ...options,
      }),
    createRefund: (input: CreatePosRefundRequest, options?: RequestOptions) =>
      client.post<CreatePosPaymentAdjustmentResponse>(
        "/pos/payment-adjustments/refunds",
        input,
        { ...options, idempotencyKey: input.idempotencyKey },
      ),
    resolveRefund: (
      adjustmentId: string,
      input: ResolvePosRefundRequest,
      options?: RequestOptions,
    ) =>
      client.post<CreatePosPaymentAdjustmentResponse>(
        `/pos/payment-adjustments/${adjustmentId}/refund-outcome`,
        input,
        options,
      ),
    createCorrection: (
      input: CreatePosPaymentCorrectionRequest,
      options?: RequestOptions,
    ) =>
      client.post<CreatePosPaymentAdjustmentResponse>(
        "/pos/payment-adjustments/corrections",
        input,
        { ...options, idempotencyKey: input.idempotencyKey },
      ),
  };
}
