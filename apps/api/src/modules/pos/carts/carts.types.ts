import type { AuthContext } from "../../auth/auth.types.js";
import type { CreateManualOrderItemRequest } from "../orders/orders.types.js";

export type PosCartCustomer = {
  id: string;
  name: string;
  accountName?: string | null;
};

export type PosCartProductLine = {
  id: string;
  kind: "product";
  productSkuId: string;
  name: string;
  sku: string;
  barcode: string | null;
  variantName: string | null;
  unitOfMeasure: string;
  unitAmount: string;
  currency: string;
  quantity: number;
  trackInventory: boolean;
  availableQuantity: string | null;
  allowNegativeStock: boolean;
  allowOfflineSale: boolean;
  offlineStockBuffer: string;
  coverUrl: string | null;
};

export type PosCartTicketItemLine = {
  id: string;
  kind: "ticket_item";
  ticketId: string;
  ticketItemId: string;
  ticketCode: string;
  serviceId: string | null;
  name: string;
  pricingUnit: "per_item" | "per_kg";
  quantity: number;
  weight: string | null;
  bagCount: number | null;
  unitAmount: string;
  lineAmount: string;
  currency: string;
  customerId: string;
  customerName: string;
};

export type PosCartSnapshot = {
  version: 2;
  checkoutId: string;
  currency: string;
  customer: PosCartCustomer | null;
  lines: Array<PosCartProductLine | PosCartTicketItemLine>;
  notes: string;
  discountCode: string;
  discountReason: string;
  updatedAt: string;
};

export type PosSavedCart = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  ownerName: string | null;
  currency: string;
  cart: PosCartSnapshot;
  name: string | null;
  status: "active" | "parked" | "converted" | "abandoned";
  clientUpdatedAt: string;
  expiresAt: string;
  parkedAt: string | null;
  parkedBy: string | null;
  claimedAt: string | null;
  claimedBy: string | null;
  handoffNote: string | null;
  updatedAt: string;
  version: number;
};

export type ParkPosCartRequest = {
  name: string;
  handoffNote?: string | null;
};

export type ClaimPosCartRequest = {
  handoffNote?: string | null;
};

export type PreviewPosCartRequest = {
  branchId: string;
  customerId?: string;
  items: CreateManualOrderItemRequest[];
  discountCode?: string;
  taxExemptionReason?: string;
};

export type PosCartPricePreview = {
  currency: string;
  lines: Array<{
    id: string;
    itemKind: "service" | "product";
    itemName: string;
    quantity: string;
    pricingUnit: "per_item" | "per_kg";
    weight: string | null;
    unitAmount: string;
    lineAmount: string;
  }>;
  discounts: Array<{
    discountId: string;
    title: string;
    code: string | null;
    method: "code" | "automatic";
    amount: string;
  }>;
  subtotalAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  taxRate: string;
  taxBreakdown: Array<{ taxRate: string; taxableAmount: string; taxAmount: string }>;
  taxLabel: string | null;
  taxComponents: Array<{ name: string; rate: string; parentRate: string; taxableAmount: string; taxAmount: string }>;
  pricesIncludeTax: boolean;
  taxExemptionReason: string | null;
  taxRegistrationNumber: string | null;
  roundingAdjustmentAmount: string;
  totalAmount: string;
  calculatedAt: string;
};

export type PosCartRequestInput<T> = {
  authContext: AuthContext;
  data: T;
};
