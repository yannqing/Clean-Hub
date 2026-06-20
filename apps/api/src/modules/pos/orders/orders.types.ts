/**
 * POS order management — DTOs.
 *
 * NOTE: scaffold only. Field shapes mirror the `orders` / `order_items` tables
 * (packages/db/src/schema/commerce.ts) but no repository is wired up yet.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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

export type PosOrderListInput = {
  authContext: AuthContext;
  query: PosOrderListQuery;
};

export type PosOrderDetailInput = {
  authContext: AuthContext;
  orderId: string;
};

export type CreatePosOrderInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosOrderRequest;
};
