import type { CreateManualOrderItemRequest } from "./orders.types";

export type PosSavedCartCustomer = {
  id: string;
  name: string;
  accountName?: string | null;
};

export type PosSavedCartProductLine = {
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

export type PosSavedCartTicketItemLine = {
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

export type PosSavedCartLine =
  | PosSavedCartProductLine
  | PosSavedCartTicketItemLine;

export type PosSavedCartSnapshot = {
  version: 2;
  /** Stable sale id retained across power-loss recovery and checkout retries. */
  checkoutId: string;
  currency: string;
  customer: PosSavedCartCustomer | null;
  lines: PosSavedCartLine[];
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
  cart: PosSavedCartSnapshot;
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

export type PosParkedCartListResponse = {
  data: PosSavedCart[];
};

export type SavePosCartRequest = {
  cart: PosSavedCartSnapshot;
};

export type SavePosCartResponse = {
  accepted: boolean;
  cart: PosSavedCart;
};

export type PreviewPosCartRequest = {
  branchId: string;
  customerId?: string;
  items: CreateManualOrderItemRequest[];
  discountCode?: string;
  taxExemptionReason?: string;
};

export type PosCartPricePreviewLine = {
  id: string;
  itemKind: "service" | "product";
  itemName: string;
  quantity: string;
  pricingUnit: "per_item" | "per_kg";
  weight: string | null;
  unitAmount: string;
  lineAmount: string;
};

export type PosCartPricePreviewDiscount = {
  discountId: string;
  title: string;
  code: string | null;
  method: "code" | "automatic";
  amount: string;
};

export type PosCartPricePreview = {
  currency: string;
  lines: PosCartPricePreviewLine[];
  discounts: PosCartPricePreviewDiscount[];
  subtotalAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  taxRate: string;
  pricesIncludeTax: boolean;
  taxExemptionReason: string | null;
  taxRegistrationNumber: string | null;
  roundingAdjustmentAmount: string;
  totalAmount: string;
  calculatedAt: string;
};
