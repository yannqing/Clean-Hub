import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

/**
 * POS service ticket (work order) management — DTOs.
 *
 * The string-literal unions mirror the Drizzle enums defined in
 * `packages/db/src/schema/tickets/service-tickets.ts` (and `businessLineEnum`
 * for `ticketType`).
 */

export type ServiceTicketType =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

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

export type ServiceTicketPricingUnit = "per_item" | "per_kg";

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
  pricingUnit: ServiceTicketPricingUnit;
  standardUnitAmount: string;
  chargedUnitAmount: string;
  weight: string | null;
  bagCount: number | null;
  /** Legacy alias retained while older POS readers migrate. */
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
  currency: string;
  customerId: string;
  customerName: string;
  customerAccountName: string | null;
  customerProfileName: string | null;
  assistantId: string | null;
  assistantName: string | null;
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

export type ServiceTicketListInput = {
  tenantId: string;
  allowedBranchIds?: string[];
  status?: ServiceTicketStatus[];
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
  limit: number;
  offset: number;
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
};

export type CreateServiceTicketRequest = {
  customerId: string;
  branchId: string;
  ticketType: ServiceTicketType;
  priority?: ServiceTicketPriority;
  sourceChannel?: ServiceTicketSourceChannel;
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
  reason?: string;
  version: number;
};

export type CreateServiceTicketItemRequest = {
  serviceId: string;
  itemType?: ServiceTicketItemType;
  itemCategory?: string;
  itemColor?: string;
  itemBrand?: string;
  itemMaterial?: string;
  quantity?: number;
  weight?: string;
  bagCount?: number;
  chargedUnitAmount?: string;
  overrideReason?: string;
  defectNotes?: string;
  specialRequest?: string;
  remark?: string;
  sortOrder?: number;
};

export type UpdateServiceTicketItemRequest = {
  serviceId?: string;
  itemType?: ServiceTicketItemType;
  itemCategory?: string | null;
  itemColor?: string | null;
  itemBrand?: string | null;
  itemMaterial?: string | null;
  quantity?: number;
  weight?: string | null;
  bagCount?: number | null;
  chargedUnitAmount?: string;
  overrideReason?: string;
  defectNotes?: string | null;
  specialRequest?: string | null;
  remark?: string | null;
  sortOrder?: number;
};

export type ChangeServiceTicketItemStatusRequest = {
  to: ServiceTicketItemStatus;
};

export type ServiceTicketOverview = {
  tenantId: string;
  branchId: string | null;
  byStatus: Partial<Record<ServiceTicketStatus, number>>;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
};

export type RelatedOrderSummary = {
  id: string;
  currency: string;
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

export type ServiceTicketInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

/**
 * Input shape shared by every ticket-item operation: the caller has resolved
 * the path-scoped `ticketId` and the authenticated context, then per-call data
 * is added on top.
 */
export type ServiceTicketItemListInput = {
  ticketId: string;
};

export type ServiceTicketAuditSnapshot = {
  tenantId: string;
  branchId: string;
  currency: string;
  customerId: string;
  ticketType: ServiceTicketType;
  ticketStatus: ServiceTicketStatus;
  priority: ServiceTicketPriority;
  sourceChannel: ServiceTicketSourceChannel;
  expectedPickupAt: string | null;
  remark: string | null;
};
