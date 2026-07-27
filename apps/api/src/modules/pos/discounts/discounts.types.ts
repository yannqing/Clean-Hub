import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosDiscountMethod = "code" | "automatic";
export type PosDiscountType =
  | "amount_off_items"
  | "buy_x_get_y"
  | "amount_off_order"
  | "free_shipping";
export type PosDiscountValueType = "percentage" | "fixed_amount" | "free";
export type PosDiscountTargetRole =
  | "applies_to"
  | "customer_buys"
  | "customer_gets";
export type PosDiscountTargetType =
  | "product"
  | "product_category"
  | "service"
  | "service_category";

export type PosDiscountTarget = {
  role: PosDiscountTargetRole;
  targetType: PosDiscountTargetType;
  targetId: string;
};

export type PosDiscountRule = {
  id: string;
  title: string;
  method: PosDiscountMethod;
  type: PosDiscountType;
  valueType: PosDiscountValueType;
  valueAmount: string | null;
  currency: string | null;
  minimumRequirement: "none" | "minimum_amount" | "minimum_quantity";
  minimumPurchaseAmount: string | null;
  minimumQuantity: string | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  combinesWithItemDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  buyRequirementType: "minimum_amount" | "minimum_quantity" | null;
  buyRequirementValue: string | null;
  getQuantity: string | null;
  maxUsesPerOrder: number | null;
  countryScope: "all" | "selected";
  maximumShippingPrice: string | null;
  codeId: string | null;
  code: string | null;
  targets: PosDiscountTarget[];
  usageCount: number;
  customerUsageCount: number;
};

export type PosDiscountPricingLine = {
  id: string;
  itemKind: "service" | "product" | "subscription" | "delivery_fee";
  lineAmount: string;
  quantity: string;
  weight: string | null;
  pricingUnit: "per_item" | "per_kg" | null;
  serviceId: string | null;
  serviceCategoryId: string | null;
  productId: string | null;
  productCategoryId: string | null;
};

export type PosDiscountPricingContext = {
  currency: string;
  lines: PosDiscountPricingLine[];
  remainingByLine?: ReadonlyMap<string, bigint>;
};

export type PosDiscountPricingAllocation = {
  orderItemId: string;
  amountMinor: bigint;
};

export type PosDiscountPricingResult = {
  discountId: string;
  amountMinor: bigint;
  allocations: PosDiscountPricingAllocation[];
};

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
  method: PosDiscountMethod;
  type: PosDiscountType;
  valueType: PosDiscountValueType | null;
  valueAmount: string | null;
  amount: string;
  currency: string;
  appliedAt: string;
  allocations: PosOrderDiscountAllocation[];
};

export type ApplyPosOrderDiscountRequest =
  | {
      code: string;
      discountId?: never;
      reason: string;
      version: number;
      idempotencyKey: string;
    }
  | {
      code?: never;
      discountId: string;
      reason: string;
      version: number;
      idempotencyKey: string;
    };

export type RemovePosOrderDiscountRequest = {
  version: number;
  reason: string;
};

export type PosOrderDiscountRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  orderId: string;
  data: TData;
};

export type PosDiscountOrderRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  currency: string;
  status: "draft" | "received" | "paid" | "delivered" | "cancelled";
  paidAmount: string;
  paymentStatus: "unpaid" | "paid" | "partial" | "refunded";
  paidAt: Date | null;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  version: number;
};

export type PosDiscountApplicationRecord = {
  id: string;
  orderId: string;
  discountId: string;
  discountCodeId: string | null;
  codeSnapshot: string | null;
  method: PosDiscountMethod;
  type: PosDiscountType;
  amount: string;
  idempotencyKey: string | null;
  status: "applied" | "voided";
  appliedAt: Date;
};

export type PosDiscountIdempotencyReceiptRecord = {
  application: PosDiscountApplicationRecord;
  intentKind: "code" | "discount_id";
  intentValue: string;
  reasonSnapshot: string | null;
};
