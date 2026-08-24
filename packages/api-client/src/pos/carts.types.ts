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
  currency: string;
  cart: PosSavedCartSnapshot;
  status: "active" | "converted" | "abandoned";
  clientUpdatedAt: string;
  expiresAt: string;
  updatedAt: string;
  version: number;
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
  totalAmount: string;
  calculatedAt: string;
};
