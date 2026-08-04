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
  createdAt: string;
  updatedAt: string;
  version: number;
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
