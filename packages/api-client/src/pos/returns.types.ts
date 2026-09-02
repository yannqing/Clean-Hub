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
    settlementReference?: string;
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
  status: "received" | "completed";
  reason: string;
  notes: string | null;
  refundAmount: string;
  returnValueAmount: string;
  exchangeCreditAmount: string;
  additionalDueAmount: string;
  currency: string;
  completedAt: string | null;
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
  exchangeOrder: import("./orders.types").PosOrderDetail | null;
};
