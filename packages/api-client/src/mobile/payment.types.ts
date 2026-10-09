export type MobilePaymentTransactionStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

export type MobileRefundRequestStatus =
  | "pending"
  | "approved"
  | "processing"
  | "rejected"
  | "refunded"
  | "failed";

export type MobilePaymentGatewayName = "mock";

export type MobilePaymentTransaction = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string | null;
  orderId: string;
  amount: string;
  currency: string;
  paymentStatus: MobilePaymentTransactionStatus;
  idempotencyKey: string | null;
  gateway: string | null;
  externalId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobilePaymentGatewayResult = {
  gateway: MobilePaymentGatewayName;
  externalId: string;
  paymentUrl: string;
  paymentToken: string;
  expiresAt: string;
};

export type MobileCreatePaymentRequest = {
  amount: string;
  idempotencyKey: string;
};

export type MobileCreatePaymentResponse = {
  transaction: MobilePaymentTransaction;
  gateway: MobilePaymentGatewayResult;
  idempotent: boolean;
};

export type MobilePaymentStatusResponse = {
  transaction: MobilePaymentTransaction;
};

export type MobileSimulateMockPaymentRequest = {
  status: Extract<MobilePaymentTransactionStatus, "paid" | "failed">;
};

export type MobilePaymentWebhookResponse = {
  accepted: boolean;
  idempotent: boolean;
  callbackId: string;
  status: "processed" | "rejected" | "failed";
};

export type MobileRefundRequest = {
  id: string;
  tenantId: string;
  branchId: string;
  customerAccountId: string;
  customerId: string;
  orderId: string;
  paymentTransactionId: string | null;
  amount: string;
  currency: string;
  reason: string;
  status: MobileRefundRequestStatus;
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

export type MobileRefundOrderDetail = {
  id: string;
  branchId: string;
  currency: string;
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

export type MobileCreateRefundRequest = {
  amount: string;
  reason: string;
};

export type MobileRefundRequestListQuery = {
  status?: MobileRefundRequestStatus;
};

export type MobileRefundRequestListResponse = {
  data: MobileRefundRequest[];
};

export type MobileApproveRefundResponse = {
  refundRequest: MobileRefundRequest;
  gateway?: {
    gateway: MobilePaymentGatewayName;
    externalId: string;
  };
};

export type MobileRejectRefundRequest = {
  reason: string;
};
