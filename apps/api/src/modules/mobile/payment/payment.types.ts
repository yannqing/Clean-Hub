import type { MobileAuthContext } from "../auth/auth.types.js";

export type PaymentGatewayName = "mock";

export type PaymentTransactionStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

export type OrderPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type RefundRequestStatus =
  | "pending"
  | "approved"
  | "processing"
  | "rejected"
  | "refunded"
  | "failed";

export type CustomerPaymentContext = MobileAuthContext & {
  subjectType: "customer";
  role: "customer";
};

export type OwnerPaymentContext = MobileAuthContext & {
  subjectType: "staff";
  role: "owner";
};

export type PaymentGatewayAction = "pay" | "refund";

export type PaymentGatewayPaymentRequest = {
  tenantId: string;
  orderId: string;
  transactionId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  customerAccountId: string;
};

export type PaymentGatewayPaymentResult = {
  gateway: PaymentGatewayName;
  externalId: string;
  paymentUrl: string;
  paymentToken: string;
  expiresAt: string;
};

export type PaymentGatewayRefundRequest = {
  tenantId: string;
  refundRequestId: string;
  transactionId: string;
  amount: string;
  currency: string;
};

export type PaymentGatewayRefundResult = {
  gateway: PaymentGatewayName;
  externalId: string;
};

export type PaymentGatewayCallbackVerification = {
  ok: boolean;
  gateway: PaymentGatewayName;
  externalId: string;
  event: string;
  action: PaymentGatewayAction;
  status: PaymentTransactionStatus;
  amount: string;
  tenantId: string;
  transactionId?: string;
  refundRequestId?: string;
  occurredAt: Date;
  failureReason?: string;
};

export type PaymentGatewayCallbackHeaders = Record<string, string | undefined>;

export type PaymentGateway = {
  readonly name: PaymentGatewayName;
  createPayment(
    input: PaymentGatewayPaymentRequest,
  ): Promise<PaymentGatewayPaymentResult>;
  verifyCallback(input: {
    payload: Record<string, unknown>;
    headers: PaymentGatewayCallbackHeaders;
  }): Promise<PaymentGatewayCallbackVerification>;
  queryPayment(input: {
    externalId: string;
  }): Promise<{ status: PaymentTransactionStatus }>;
  createRefund(
    input: PaymentGatewayRefundRequest,
  ): Promise<PaymentGatewayRefundResult>;
};

export type PaymentConfig = {
  gateway: PaymentGatewayName;
  currency: string;
  mockSecret: string;
  mockPaymentBaseUrl: string;
};

export type CustomerPaymentTransaction = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  orderId: string;
  amount: string;
  paymentStatus: PaymentTransactionStatus;
  idempotencyKey: string | null;
  gateway: PaymentGatewayName | string | null;
  externalId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentInitiationResult = {
  transaction: CustomerPaymentTransaction;
  gateway: PaymentGatewayPaymentResult;
  idempotent: boolean;
};

export type PaymentStatusResult = {
  transaction: CustomerPaymentTransaction;
};

export type CreatePaymentInput = {
  authContext: MobileAuthContext;
  orderId: string;
  amount: string;
  idempotencyKey: string;
};

export type GetPaymentStatusInput = {
  authContext: MobileAuthContext;
  paymentId: string;
};

export type SimulateMockPaymentInput = {
  authContext: MobileAuthContext;
  paymentId: string;
  status: Extract<PaymentTransactionStatus, "paid" | "failed">;
};

export type PaymentWebhookInput = {
  gateway: PaymentGatewayName;
  payload: Record<string, unknown>;
  headers: PaymentGatewayCallbackHeaders;
};

export type PaymentWebhookResult = {
  accepted: boolean;
  idempotent: boolean;
  callbackId: string;
  status: "processed" | "rejected" | "failed";
};

export type RefundRequest = {
  id: string;
  tenantId: string;
  branchId: string;
  customerAccountId: string;
  customerId: string;
  orderId: string;
  paymentTransactionId: string | null;
  amount: string;
  reason: string;
  status: RefundRequestStatus;
  gateway: string | null;
  externalId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  refundedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RefundOrderDetail = {
  id: string;
  branchId: string;
  customerId: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    itemName: string;
    quantity: string;
    unitAmount: string;
    lineAmount: string;
  }>;
};

export type CreateRefundRequestInput = {
  authContext: MobileAuthContext;
  orderId: string;
  amount: string;
  reason: string;
};

export type ListRefundRequestsInput = {
  authContext: MobileAuthContext;
  status?: RefundRequestStatus;
};

export type ApproveRefundRequestInput = {
  authContext: MobileAuthContext;
  refundRequestId: string;
};

export type RejectRefundRequestInput = {
  authContext: MobileAuthContext;
  refundRequestId: string;
  reason: string;
};

export type RefundApprovalResult = {
  refundRequest: RefundRequest;
  gateway?: PaymentGatewayRefundResult;
};

export type PaymentErrorCode =
  | "PAYMENT_FORBIDDEN"
  | "PAYMENT_ORDER_NOT_FOUND"
  | "PAYMENT_TRANSACTION_NOT_FOUND"
  | "PAYMENT_REFUND_NOT_FOUND"
  | "PAYMENT_VALIDATION_ERROR"
  | "PAYMENT_CONFLICT"
  | "PAYMENT_CALLBACK_INVALID"
  | "PAYMENT_GATEWAY_UNAVAILABLE";

export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 | 502,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
