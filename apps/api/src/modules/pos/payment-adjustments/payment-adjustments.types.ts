import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosPaymentAdjustmentType = "refund" | "correction";
export type PosPaymentAdjustmentDirection = "debit" | "credit";
export type PosPaymentAdjustmentStatus = "pending" | "succeeded" | "failed";

export type PosPaymentAdjustment = {
  id: string;
  orderId: string;
  originalPaymentId: string | null;
  adjustmentType: PosPaymentAdjustmentType;
  direction: PosPaymentAdjustmentDirection;
  status: PosPaymentAdjustmentStatus;
  salesReturnId: string | null;
  amount: string;
  currency: string;
  idempotencyKey: string;
  reason: string;
  settlementReference: string | null;
  failureReason: string | null;
  resolvedAt: string | null;
  occurredAt: string;
  createdAt: string;
  createdBy: string;
};

export type CreatePosRefundRequest = {
  orderId: string;
  originalPaymentId: string;
  amount: string;
  idempotencyKey: string;
  reason: string;
  salesReturnId?: string;
  settlementStatus?: "pending" | "succeeded";
  settlementReference?: string;
};

export type ResolvePosRefundRequest = {
  outcome: "succeeded" | "failed";
  settlementReference?: string;
  reason: string;
};

export type CreatePosPaymentCorrectionRequest = {
  orderId: string;
  originalPaymentId: string;
  direction: PosPaymentAdjustmentDirection;
  amount: string;
  idempotencyKey: string;
  reason: string;
};

export type CreatePosPaymentAdjustmentResponse = {
  adjustment: PosPaymentAdjustment;
  idempotent: boolean;
  paidAmount: string;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
};

export type PosPaymentAdjustmentMutationInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};
