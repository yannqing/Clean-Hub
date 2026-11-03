import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import type { ServiceTicketStatus } from "../service-tickets/service-tickets.types.js";
import type { TaxBreakdownAmount } from "../../tax/tax.breakdown.js";

export type PosOrderType = "ticket" | "manual";

export type PosOrderStatus =
  | "draft"
  | "received"
  | "paid"
  | "delivered"
  | "cancelled";

export type PosOrderPaymentStatus = "unpaid" | "paid" | "partial" | "refunded";
export type PosOrderSettlementIntent = "pay_now" | "partial" | "pay_later";

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

export type PosPaymentProviderStatus =
  | "not_applicable"
  | "initiated"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

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
  taxableAmount: string;
  taxAmount: string;
  taxRateSnapshot: string;
  taxExemptionReason: string | null;
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
  tenderedAmount: string | null;
  changeAmount: string | null;
  shiftId: string | null;
  registerSessionId: string | null;
  cashDrawerSessionId: string | null;
  currency: string;
  paymentStatus: PosPaymentTransactionStatus;
  providerStatus: PosPaymentProviderStatus;
  provider: PosMobileMoneyProvider | null;
  gateway: string | null;
  externalReference: string | null;
  authorizationCode: string | null;
  failureCode: string | null;
  failureReason: string | null;
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
  taxableAmount: string;
  taxAmount: string;
  taxRateSnapshot: string;
  pricesIncludeTax: boolean;
  taxExemptionReason: string | null;
  taxRegistrationNumberSnapshot: string | null;
  taxLabelSnapshot?: string | null;
  taxComponentsSnapshot?: Array<{
    name: string;
    rate: string;
    parentRate: string;
    taxableAmount: string;
    taxAmount: string;
  }> | null;
  roundingAdjustmentAmount: string;
  totalAmount: string;
  paymentStatus: PosOrderPaymentStatus;
  paidAmount: string;
  paidAt: string | null;
  settlementIntent: PosOrderSettlementIntent;
  balanceDueAt: string | null;
  unpaidReason: string | null;
  expireAt: string | null;
  notes: string | null;
  itemCount: number;
  itemNames: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

/**
 * Fulfilment context captured from a service ticket at checkout. Snapshotted,
 * so an order keeps showing what the clerk agreed to even if the ticket is
 * edited or cancelled later.
 */
export type PosOrderTicketReference = {
  ticketId: string;
  ticketNo: string | null;
  /** Live workflow status; the remaining fields are checkout snapshots. */
  ticketStatus: ServiceTicketStatus;
  remark: string | null;
  priority: "normal" | "urgent" | "critical";
  expectedPickupAt: string | null;
  assistantName: string | null;
  itemCount: number;
  itemAmount: string;
};

export type PosOrderDetail = PosOrderSummary & {
  items: PosOrderItem[];
  /** Taxable base and tax per rate, dominant first, as a receipt prints them. */
  taxBreakdown: TaxBreakdownAmount[];
  discountApplications: PosOrderDiscountApplication[];
  ticketReferences: PosOrderTicketReference[];
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
      ticketId?: never;
      ticketItemId?: never;
    })
  | (CreateManualOrderItemBaseRequest & {
      serviceId?: never;
      productSkuId: string;
      ticketId?: never;
      ticketItemId?: never;
    })
  | {
      serviceId?: never;
      productSkuId?: never;
      ticketId: string;
      ticketItemId: string;
    };

export type CreateManualOrderRequest = {
  id?: string;
  orderType: "manual";
  branchId: string;
  customerId?: string;
  items: CreateManualOrderItemRequest[];
  expireAt?: string | null;
  notes?: string | null;
  discountCode?: string;
  discountReason?: string;
  discountIdempotencyKey?: string;
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
      /** Required by the POS HTTP schema; omitted only by tenant back-office flows. */
      tenderedAmount?: string;
      shiftId?: string;
      registerSessionId?: string;
      cashDrawerSessionId?: string;
      occurredAt?: string;
      idempotencyKey: string;
    }
  | {
      paymentMethod: "card";
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

export type CreatePosCheckoutPaymentRequest =
  | {
      paymentMethod: "cash";
      amount?: string;
      /** Required by the POS HTTP schema; optional for internal back-office checkout. */
      tenderedAmount?: string;
      shiftId?: string;
      registerSessionId?: string;
      cashDrawerSessionId?: string;
      occurredAt?: string;
      idempotencyKey: string;
    }
  | {
      paymentMethod: "card";
      amount?: string;
      idempotencyKey: string;
    }
  | {
      paymentMethod: "app";
      amount?: string;
      provider: PosMobileMoneyProvider;
      externalReference: string;
      idempotencyKey: string;
    };

export type CreatePosCheckoutRequest = {
  order: CreatePosOrderRequest;
  /** Total displayed and explicitly accepted by the operator. */
  expectedTotalAmount: string;
  /** Omit to create an unpaid/pay-later order. */
  payment?: CreatePosCheckoutPaymentRequest;
  /** Multiple tenders recorded atomically with the order. */
  payments?: CreatePosCheckoutPaymentRequest[];
  /** Explicit operator intent whenever the order is not fully settled now. */
  settlementIntent: PosOrderSettlementIntent;
  balanceDueAt?: string;
  unpaidReason?: string;
  taxExemptionReason?: string;
  /**
   * Cashier chose to round the cash total down. Only honoured when the tender
   * is entirely cash: an electronic payment has no physical change constraint
   * to concede for. Without `cashRoundingStep` this means "use the branch's
   * configured note", which is how payloads queued offline still behave.
   */
  cashRoundingApplied?: boolean;
  /**
   * Denomination chosen for this sale, in major units. The server computes the
   * concession from it, so the cashier picks the coarseness, not the amount.
   */
  cashRoundingStep?: number;
};

export type CreatePosCheckoutResponse = {
  order: PosOrderDetail;
  payment: PosPaymentTransaction | null;
  payments: PosPaymentTransaction[];
  idempotent: boolean;
};

export type PosCardPaymentOutcome =
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export type RecordPosCardPaymentOutcomeRequest = {
  outcome: PosCardPaymentOutcome;
  externalReference?: string;
  authorizationCode?: string;
  failureCode?: string;
  failureReason?: string;
  providerPayload?: Record<string, unknown>;
};

export type ResolvePosPaymentRequest = {
  reason?: string;
};

export type CreatePosOrderItemRequest = Exclude<
  CreateManualOrderItemRequest,
  { ticketId: string }
>;

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
