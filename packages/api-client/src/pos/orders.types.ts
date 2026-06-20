export type PosOrderStatus =
  | "draft"
  | "received"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export type PosOrderPaymentStatus = "unpaid" | "paid" | "partial" | "refunded";

export type PosOrderItem = {
  id: string;
  serviceName: string;
  pricingUnit: string;
  unitPrice: string;
  quantity: string;
  lineAmount: string;
};

export type PosOrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: PosOrderStatus;
  paymentStatus: PosOrderPaymentStatus;
  totalAmount: string;
  currency: string;
  createdAt: string;
};

export type PosOrderDetail = PosOrderSummary & {
  customerId: string;
  branchId: string;
  subtotalAmount: string;
  discountAmount: string;
  items: PosOrderItem[];
  pickupDate: string | null;
  notes: string | null;
};

export type PosOrderListQuery = {
  status?: PosOrderStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type PosOrderListResponse = {
  data: PosOrderSummary[];
};

export type CreatePosOrderItemRequest = {
  serviceId: string;
  quantity: string;
  unitPrice?: string;
  notes?: string;
};

export type CreatePosOrderRequest = {
  customerId: string;
  items: CreatePosOrderItemRequest[];
  discountAmount?: string;
  pickupDate?: string;
  notes?: string;
};
