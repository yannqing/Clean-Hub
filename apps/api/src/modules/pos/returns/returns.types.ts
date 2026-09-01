import type { PosOrderDetail } from "../orders/orders.types.js";

export type PosReturnItemCondition =
  | "unopened"
  | "good"
  | "damaged"
  | "defective"
  | "unknown";
export type PosReturnDisposition =
  | "restock"
  | "damaged"
  | "discarded"
  | "exchange";

export type CreatePosProductReturnRequest = {
  idempotencyKey: string;
  reason: string;
  notes?: string;
  items: Array<{
    orderItemId: string;
    quantity: string;
    condition: PosReturnItemCondition;
    disposition: PosReturnDisposition;
    reason?: string;
  }>;
  refundAllocations?: Array<{
    originalPaymentId: string;
    amount: string;
  }>;
  exchangeItems?: Array<{ productSkuId: string; quantity: string }>;
};

export type PosProductReturnItem = {
  id: string;
  orderItemId: string;
  productSkuId: string;
  quantity: string;
  condition: PosReturnItemCondition;
  disposition: PosReturnDisposition;
  refundAmount: string;
  reason: string | null;
};

export type PosProductReturn = {
  id: string;
  orderId: string;
  exchangeOrderId: string | null;
  status: "completed";
  reason: string;
  notes: string | null;
  refundAmount: string;
  currency: string;
  completedAt: string;
  createdAt: string;
  createdBy: string;
  items: PosProductReturnItem[];
};

export type PosReturnableProductItem = {
  orderItemId: string;
  productSkuId: string;
  itemName: string;
  sku: string | null;
  purchasedQuantity: string;
  returnedQuantity: string;
  returnableQuantity: string;
  lineAmount: string;
  trackInventory: boolean;
};

export type PosProductReturnsOverview = {
  data: PosProductReturn[];
  returnableItems: PosReturnableProductItem[];
};

export type CreatePosProductReturnResponse = {
  salesReturn: PosProductReturn;
  exchangeOrder: PosOrderDetail | null;
};
