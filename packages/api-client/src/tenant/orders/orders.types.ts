import type {
  CreatePosOrderItemRequest,
  DeletePosOrderItemRequest,
  PosOrderDiscountApplication,
  PosOrderItem,
  PosPaymentTransaction,
  UpdatePosOrderItemRequest,
} from "../../pos/orders.types";
import type {
  CreatePosPaymentCorrectionRequest,
  CreatePosRefundRequest,
  PosPaymentAdjustment,
} from "../../pos/payment-adjustments.types";

export type TenantOrderType = "ticket" | "manual";

export type TenantOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type TenantOrderPaymentStatus =
  | "unpaid"
  | "paid"
  | "partial"
  | "refunded";

export type TenantOrderSort =
  | "created_desc"
  | "created_asc"
  | "amount_desc"
  | "amount_asc";

export type TenantOrderSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  currency: string;
  customerId: string;
  customerName: string;
  orderType: TenantOrderType;
  status: TenantOrderStatus;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentStatus: TenantOrderPaymentStatus;
  paidAmount: string;
  paidAt: string | null;
  expireAt: string | null;
  notes: string | null;
  itemCount: number;
  itemNames: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantOrderItem = PosOrderItem;

export type TenantOrderDiscountApplication = PosOrderDiscountApplication;
export type TenantOrderPaymentTransaction = PosPaymentTransaction;
export type TenantOrderPaymentAdjustment = PosPaymentAdjustment;

export type CreateTenantOrderItemRequest = CreatePosOrderItemRequest;
export type UpdateTenantOrderItemRequest = UpdatePosOrderItemRequest;
export type DeleteTenantOrderItemRequest = DeletePosOrderItemRequest;
export type CreateTenantOrderRefundRequest = Omit<
  CreatePosRefundRequest,
  "orderId"
>;
export type CreateTenantOrderPaymentCorrectionRequest = Omit<
  CreatePosPaymentCorrectionRequest,
  "orderId"
>;

export type TenantOrderCapabilities = {
  canEdit: boolean;
  canCancel: boolean;
  canRecordPayment: boolean;
  canRefundPayments: boolean;
  canCorrectPayments: boolean;
  canMarkDelivered: boolean;
  canComment: boolean;
  allowedNextStatuses: TenantOrderStatus[];
};

export type TenantOrderDetail = TenantOrderSummary & {
  items: TenantOrderItem[];
  discountApplications: TenantOrderDiscountApplication[];
  payments: TenantOrderPaymentTransaction[];
  paymentAdjustments: TenantOrderPaymentAdjustment[];
  capabilities: TenantOrderCapabilities;
};

export type TenantOrderTimelineKind = "system" | "comment";

export type TenantOrderTimelineSource =
  | "order"
  | "service_ticket"
  | "delivery"
  | "comment"
  | "synthetic";

export type TenantOrderTimelineDataValue = string | number | boolean | null;

export type TenantOrderCommentMention = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type TenantOrderCommentAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  expiresAt: string;
};

export type TenantOrderCommentAttachmentInput = {
  objectKey: string;
  fileName: string;
};

export type TenantOrderAttachmentUploadRequest = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
};

export type TenantOrderAttachmentUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type TenantOrderTimelineItem = {
  id: string;
  kind: TenantOrderTimelineKind;
  source: TenantOrderTimelineSource;
  eventType: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  data: Record<string, TenantOrderTimelineDataValue>;
  body: string | null;
  editedAt: string | null;
  version: number | null;
  mentions: TenantOrderCommentMention[];
  attachments: TenantOrderCommentAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  occurredAt: string;
};

export type TenantOrderTimelineQuery = {
  cursor?: string;
  limit?: number;
};

export type TenantOrderTimelineResponse = {
  data: TenantOrderTimelineItem[];
  nextCursor: string | null;
};

export type CreateTenantOrderCommentRequest = {
  body: string;
  idempotencyKey: string;
  mentionedUserIds?: string[];
  attachments?: TenantOrderCommentAttachmentInput[];
};

export type UpdateTenantOrderCommentRequest = {
  body: string;
  version: number;
  mentionedUserIds?: string[];
};

export type DeleteTenantOrderCommentRequest = {
  version: number;
};

export type ChangeTenantOrderStatusRequest = {
  to: Extract<TenantOrderStatus, "received" | "delivered" | "cancelled">;
  note?: string;
  reason?: string;
  version: number;
};

export type CreateTenantOrderPaymentRequest = {
  paymentMethod: "cash";
  amount: string;
  idempotencyKey: string;
};

export type TenantOrderListQuery = {
  status?: TenantOrderStatus;
  paymentStatus?: TenantOrderPaymentStatus;
  orderType?: TenantOrderType;
  customerId?: string;
  branchId?: string;
  q?: string;
  createdAfter?: string;
  createdBefore?: string;
  sort?: TenantOrderSort;
  limit?: number;
  offset?: number;
};

export type TenantOrderListResponse = {
  data: TenantOrderSummary[];
  total: number;
};

export type TenantOrderImportItem = {
  serviceId: string;
  quantity?: string;
  weight?: string;
  bagCount?: number;
};

export type TenantOrderImportOrder = {
  id: string;
  importKey: string;
  branchId: string;
  customerId: string;
  notes?: string;
  expireAt?: string;
  items: TenantOrderImportItem[];
};

export type TenantOrderImportRequest = {
  orders: TenantOrderImportOrder[];
};

export type TenantOrderImportFailure = {
  importKey: string;
  code: string;
  message: string;
};

export type TenantOrderImportResponse = {
  imported: number;
  failed: number;
  failures: TenantOrderImportFailure[];
  data: TenantOrderDetail[];
};

export type TenantOrderOverviewPeriod = "all" | "today" | "week" | "month";

export type TenantOrderOverviewQuery = {
  period?: TenantOrderOverviewPeriod;
  branchId?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type TenantOrderOverviewPaymentMethod = {
  method: "cash" | "card" | "app";
  provider: "wave" | "orange_money" | null;
  amount: string;
  count: number;
};

export type TenantOrderOverview = {
  tenantId: string;
  branchId: string | null;
  currency: string;
  period: TenantOrderOverviewPeriod;
  orderCount: number;
  totalAmount: string;
  paidAmount: string;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  deliveredCount: number;
  cancelledCount: number;
  paymentMethods: TenantOrderOverviewPaymentMethod[];
};
