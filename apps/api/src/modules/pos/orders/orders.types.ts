import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosOrderType = "ticket" | "manual";

export type PosOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type PosOrderPaymentStatus = "unpaid" | "paid" | "partial" | "refunded";

export type PosOrderSort =
  | "created_desc"
  | "created_asc"
  | "amount_desc"
  | "amount_asc";

export type PosOrderItemSourceType =
  | "ticket_item"
  | "service"
  | "subscription"
  | "delivery_fee"
  | "product";

export type PosOrderItemKind =
  | "service"
  | "product"
  | "subscription"
  | "delivery_fee";

export type PosOrderDiscountAllocation = {
  id: string;
  orderItemId: string;
  amount: string;
};

export type PosOrderDiscountApplication = {
  id: string;
  discountId: string;
  discountCodeId: string | null;
  title: string;
  code: string | null;
  method: "code" | "automatic";
  type:
    | "amount_off_items"
    | "buy_x_get_y"
    | "amount_off_order"
    | "free_shipping";
  valueType: "percentage" | "fixed_amount" | "free" | null;
  valueAmount: string | null;
  amount: string;
  currency: string;
  appliedAt: string;
  allocations: PosOrderDiscountAllocation[];
};

export type PosPaymentMethod = "cash" | "card" | "app";

export type PosMobileMoneyProvider = "wave" | "orange_money";

export type PosPaymentTransactionStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "failed";

export type PosOrderItem = {
  id: string;
  orderId: string;
  ticketId: string | null;
  itemKind: PosOrderItemKind;
  sourceType: PosOrderItemSourceType;
  sourceId: string;
  serviceId: string | null;
  productSkuId: string | null;
  productPriceId: string | null;
  itemName: string;
  sku: string | null;
  barcode: string | null;
  variantName: string | null;
  unitOfMeasure: string | null;
  unitCostAmount: string | null;
  quantity: string;
  pricingUnit: "per_item" | "per_kg" | null;
  standardUnitAmount: string;
  chargedUnitAmount: string;
  weight: string | null;
  bagCount: number | null;
  unitAmount: string;
  lineAmount: string;
  itemColor: string | null;
  defectNotes: string | null;
  specialRequest: string | null;
  itemIdentifier: string | null;
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
  provider: PosMobileMoneyProvider | null;
  externalReference: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PosOrderSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  currency: string;
  customerId: string | null;
  customerName: string | null;
  orderType: PosOrderType;
  status: PosOrderStatus;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentStatus: PosOrderPaymentStatus;
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

export type PosOrderDetail = PosOrderSummary & {
  items: PosOrderItem[];
  discountApplications: PosOrderDiscountApplication[];
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
  sort?: PosOrderSort;
  limit?: number;
  offset?: number;
};

export type PosOrderListResponse = {
  data: PosOrderSummary[];
  total: number;
};

export type CreateTicketBasedOrderRequest = {
  id?: string;
  orderType: "ticket";
  ticketId: string;
  ticketItemIds?: string[];
  expireAt?: string | null;
  notes?: string | null;
};

type CreateManualOrderItemBaseRequest = {
  quantity?: string;
  weight?: string;
  bagCount?: number;
  chargedUnitAmount?: string;
  overrideReason?: string;
  itemColor?: string;
  defectNotes?: string;
  specialRequest?: string;
  itemIdentifier?: string;
};

export type CreateManualOrderItemRequest =
  | (CreateManualOrderItemBaseRequest & {
      serviceId: string;
      productSkuId?: never;
    })
  | (CreateManualOrderItemBaseRequest & {
      serviceId?: never;
      productSkuId: string;
    });

export type CreateManualOrderRequest = {
  id?: string;
  orderType: "manual";
  branchId: string;
  customerId?: string;
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
  reason?: string;
  version: number;
};

export type DeletePosOrderRequest = {
  reason: string;
};

export type CreatePosPaymentRequest =
  | {
      paymentMethod: "cash";
      amount: string;
      idempotencyKey: string;
    }
  | {
      paymentMethod: "app";
      amount: string;
      provider: PosMobileMoneyProvider;
      externalReference: string;
      idempotencyKey: string;
    };

export type CreatePosPaymentResponse = {
  order: PosOrderDetail;
  payment: PosPaymentTransaction;
  idempotent: boolean;
};

export type ResolvePosPaymentRequest = {
  reason?: string;
};

export type CreatePosOrderItemRequest = CreateManualOrderItemRequest;

export type UpdatePosOrderItemRequest = {
  serviceId?: string;
  productSkuId?: string;
  quantity?: string;
  weight?: string;
  bagCount?: number;
  chargedUnitAmount?: string;
  overrideReason?: string;
  itemColor?: string | null;
  defectNotes?: string | null;
  specialRequest?: string | null;
  itemIdentifier?: string | null;
  version: number;
};

export type DeletePosOrderItemRequest = {
  reason: string;
};

export type PosOrderOverviewPeriod = "all" | "today" | "week" | "month";

export type PosOrderOverviewQuery = {
  period?: PosOrderOverviewPeriod;
  branchId?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type PosOrderOverviewPaymentMethod = {
  method: PosPaymentMethod;
  provider: PosMobileMoneyProvider | null;
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

export type PosOrderListInput = {
  tenantId: string;
  allowedBranchIds?: string[];
  query: PosOrderListQuery;
};

export type PosOrderDetailInput = {
  tenantId: string;
  orderId: string;
};

export type PosOrderScope = {
  tenantId: string;
  branchId: string;
  actorUserId: string;
};

export type CreatePosOrderInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosOrderRequest;
};
