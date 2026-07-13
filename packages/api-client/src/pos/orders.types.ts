import type { PosPaymentMethod } from "./terminal-settings.types";

export type PosOrderType = "ticket" | "manual";

export type PosOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type PosOrderPaymentStatus = "unpaid" | "paid" | "partial" | "refunded";

export type PosOrderItemSourceType =
  | "ticket_item"
  | "subscription"
  | "delivery_fee"
  | "product";

export type PosPaymentTransactionStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

export type PosOrderItem = {
  id: string;
  orderId: string;
  ticketId: string | null;
  sourceType: PosOrderItemSourceType;
  sourceId: string;
  itemName: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosPaymentTransaction = {
  id: string;
  orderId: string;
  paymentMethod: PosPaymentMethod;
  amount: string;
  currency: string;
  paymentStatus: PosPaymentTransactionStatus;
  paidAt: string | null;
  createdAt: string;
};

export type PosOrderSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  currency: string;
  customerId: string;
  customerName: string;
  orderType: PosOrderType;
  status: PosOrderStatus;
  totalAmount: string;
  paymentStatus: PosOrderPaymentStatus;
  paidAmount: string;
  paidAt: string | null;
  expireAt: string | null;
  notes: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosOrderDetail = PosOrderSummary & {
  items: PosOrderItem[];
};

export type PosOrderListQuery = {
  status?: PosOrderStatus | PosOrderStatus[];
  paymentStatus?: PosOrderPaymentStatus;
  orderType?: PosOrderType;
  customerId?: string;
  branchId?: string;
  q?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
};

export type PosOrderListResponse = {
  data: PosOrderSummary[];
  total: number;
};

export type CreateTicketBasedOrderRequest = {
  orderType: "ticket";
  ticketId: string;
  ticketItemIds?: string[];
  expireAt?: string | null;
  notes?: string | null;
};

export type CreateManualOrderItemRequest = {
  sourceType: Exclude<PosOrderItemSourceType, "ticket_item">;
  sourceId?: string;
  itemName: string;
  quantity: string;
  unitAmount: string;
};

export type CreateManualOrderRequest = {
  orderType: "manual";
  branchId: string;
  customerId: string;
  items: CreateManualOrderItemRequest[];
  expireAt?: string | null;
  notes?: string | null;
};

export type CreatePosOrderRequest =
  | CreateTicketBasedOrderRequest
  | CreateManualOrderRequest;

export type UpdatePosOrderRequest = {
  orderType?: PosOrderType;
  expireAt?: string | null;
  notes?: string | null;
  version: number;
};

export type ChangePosOrderStatusRequest = {
  to: PosOrderStatus;
  note?: string;
  version: number;
};

export type CreatePosPaymentRequest = {
  paymentMethod: PosPaymentMethod;
  amount: string;
};

export type CreatePosOrderItemRequest = CreateManualOrderItemRequest;

export type UpdatePosOrderItemRequest = {
  itemName?: string;
  quantity?: string;
  unitAmount?: string;
  version: number;
};

export type PosOrderPaymentsResponse = {
  data: PosPaymentTransaction[];
};

export type PosOrderOverviewPeriod = "all" | "today" | "week" | "month";

export type PosOrderOverviewQuery = {
  period?: PosOrderOverviewPeriod;
  branchId?: string;
};

export type PosOrderOverviewPaymentMethod = {
  method: PosPaymentMethod;
  amount: string;
  count: number;
};

export type PosOrderOverview = {
  tenantId: string;
  branchId: string | null;
  currency: string;
  period: PosOrderOverviewPeriod;
  orderCount: number;
  totalAmount: string;
  paidAmount: string;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  deliveredCount: number;
  cancelledCount: number;
  paymentMethods: PosOrderOverviewPaymentMethod[];
};
