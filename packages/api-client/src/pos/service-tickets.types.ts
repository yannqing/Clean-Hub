/**
 * POS service ticket (work order) — DTOs.
 *
 * Mirrors the backend enums from `packages/db/src/schema/tickets/service-tickets.ts`
 * and the API responses from `/pos/service-tickets`. Decimals are typed as
 * strings to avoid floating-point loss (matching the existing `pos/orders`
 * client convention).
 */

export type ServiceTicketType = "laundry" | "car_wash" | "retail" | "delivery";

export type ServiceTicketStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "ready_to_pick"
  | "picked_up"
  | "cancelled"
  | "exception";

export type ServiceTicketPriority = "normal" | "urgent" | "critical";

export type ServiceTicketSourceChannel = "pos" | "app" | "phone" | "whatsapp";

export type ServiceTicketItemType = "cloth" | "car" | "shoe" | "carpet";

export type ServiceTicketItemStatus = "pending_wash" | "washing" | "done" | "ready_to_pick" | "exception";

export type ServiceTicketItem = {
  id: string;
  ticketId: string;
  itemType: ServiceTicketItemType | null;
  itemName: string;
  itemCategory: string | null;
  itemStatus: ServiceTicketItemStatus;
  itemColor: string | null;
  itemBrand: string | null;
  itemMaterial: string | null;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
  serviceId: string | null;
  labelCode: string | null;
  defectNotes: string | null;
  specialRequest: string | null;
  remark: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ServiceTicketSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  customerName: string;
  assistantId: string | null;
  ticketNo: string | null;
  ticketType: ServiceTicketType;
  ticketStatus: ServiceTicketStatus;
  priority: ServiceTicketPriority;
  sourceChannel: ServiceTicketSourceChannel;
  expectedPickupAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  itemCount: number;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ServiceTicketDetail = ServiceTicketSummary & {
  remark: string | null;
  items: ServiceTicketItem[];
};

export type ServiceTicketListQuery = {
  status?: ServiceTicketStatus | ServiceTicketStatus[];
  priority?: ServiceTicketPriority;
  ticketType?: ServiceTicketType;
  sourceChannel?: ServiceTicketSourceChannel;
  customerId?: string;
  branchId?: string;
  assistantId?: string;
  q?: string;
  createdBefore?: string;
  createdAfter?: string;
  expectedPickupBefore?: string;
  expectedPickupAfter?: string;
  limit?: number;
  offset?: number;
};

export type ServiceTicketListResponse = {
  data: ServiceTicketSummary[];
  /** Total matching rows (ignores limit/offset), for pagination UI. */
  total: number;
};

export type ServiceTicketOverview = {
  tenantId: string;
  branchId: string | null;
  byStatus: Partial<Record<ServiceTicketStatus, number>>;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
};

export type CreateServiceTicketRequest = {
  customerId: string;
  branchId: string;
  ticketType: ServiceTicketType;
  priority?: ServiceTicketPriority;
  sourceChannel?: ServiceTicketSourceChannel;
  assistantId?: string | null;
  expectedPickupAt?: string | null;
  remark?: string;
};

export type UpdateServiceTicketRequest = {
  ticketType?: ServiceTicketType;
  priority?: ServiceTicketPriority;
  sourceChannel?: ServiceTicketSourceChannel;
  assistantId?: string | null;
  expectedPickupAt?: string | null;
  remark?: string | null;
};

export type ChangeServiceTicketStatusRequest = {
  to: ServiceTicketStatus;
  note?: string;
  version: number;
};

export type CreateServiceTicketItemRequest = {
  itemName: string;
  itemType?: ServiceTicketItemType;
  itemCategory?: string;
  itemColor?: string;
  itemBrand?: string;
  itemMaterial?: string;
  quantity?: number;
  unitAmount: string;
  serviceId?: string | null;
  defectNotes?: string;
  specialRequest?: string;
  remark?: string;
  sortOrder?: number;
};

export type UpdateServiceTicketItemRequest = {
  itemName?: string;
  itemType?: ServiceTicketItemType;
  itemCategory?: string | null;
  itemColor?: string | null;
  itemBrand?: string | null;
  itemMaterial?: string | null;
  quantity?: number;
  unitAmount?: string;
  serviceId?: string | null;
  defectNotes?: string | null;
  specialRequest?: string | null;
  remark?: string | null;
  sortOrder?: number;
};

export type ChangeServiceTicketItemStatusRequest = {
  to: ServiceTicketItemStatus;
};

export type RelatedOrderSummary = {
  id: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
};

export type RelatedOrderListResponse = {
  data: RelatedOrderSummary[];
};

export type ServiceTicketErrorCode =
  | "SERVICE_TICKET_NOT_FOUND"
  | "SERVICE_TICKET_ITEM_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_ITEM_STATUS_TRANSITION"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DISABLED"
  | "BRANCH_NOT_ALLOWED"
  | "FEATURE_DISABLED"
  | "PICKUP_REQUIRES_SETTLEMENT"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR";

export type ServiceTicketErrorResponse = {
  message: string;
  code: ServiceTicketErrorCode;
  requestId?: string;
  validationErrors?: unknown;
};
