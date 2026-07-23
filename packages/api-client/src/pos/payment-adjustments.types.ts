export type PosPaymentAdjustmentType = "refund" | "correction";
export type PosPaymentAdjustmentDirection = "debit" | "credit";

export type PosPaymentAdjustment = {
  id: string;
  orderId: string;
  originalPaymentId: string | null;
  adjustmentType: PosPaymentAdjustmentType;
  direction: PosPaymentAdjustmentDirection;
  amount: string;
  currency: string;
  idempotencyKey: string;
  reason: string;
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

export type PosPaymentAdjustmentListResponse = {
  data: PosPaymentAdjustment[];
};
