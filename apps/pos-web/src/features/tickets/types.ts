/**
 * 工单管理 — local types.
 *
 * Wire DTOs are re-exported from `@cleanhub/api-client` so the client stays
 * the single source of truth. UI-only types live below.
 */

export type {
  ChangeServiceTicketItemStatusRequest,
  ChangeServiceTicketStatusRequest,
  CreateServiceTicketItemRequest,
  CreateServiceTicketRequest,
  RelatedOrderSummary,
  ServiceTicketDetail,
  ServiceTicketItem,
  ServiceTicketItemType,
  ServiceTicketItemStatus,
  ServiceTicketListQuery,
  ServiceTicketListResponse,
  ServiceTicketOverview,
  ServiceTicketPriority,
  ServiceTicketSourceChannel,
  ServiceTicketStatus,
  ServiceTicketSummary,
  ServiceTicketType,
  UpdateServiceTicketItemRequest,
  UpdateServiceTicketRequest,
} from "@cleanhub/api-client";

/**
 * Scope selector for the list page. `mine` filters to the current user's
 * tickets via `assistantId`; `all` lists every ticket the user can see.
 */
export type TicketListScope = "mine" | "all";

/** Quick date filter on the list page (text values map to query params). */
export type TicketListDateFilter = "all" | "pickup_today" | "overdue" | "last_7d";

/** Form values for the basic-info edit form (mirrors UpdateServiceTicketRequest). */
export type TicketBasicFormValues = {
  ticketType: import("@cleanhub/api-client").ServiceTicketType;
  priority: import("@cleanhub/api-client").ServiceTicketPriority;
  sourceChannel: import("@cleanhub/api-client").ServiceTicketSourceChannel;
  expectedPickupAt: string; // datetime-local string, "" when cleared
  remark: string;
};

/** Form values for a ticket item (create/edit). */
export type TicketItemFormValues = {
  serviceId: string;
  pricingUnit: import("@cleanhub/api-client").ServiceTicketPricingUnit;
  standardUnitAmount: string;
  chargedUnitAmount: string;
  priceTouched: boolean;
  itemType: import("@cleanhub/api-client").ServiceTicketItemType | "";
  itemCategory: string;
  itemColor: string;
  itemBrand: string;
  itemMaterial: string;
  quantity: string; // keep as string in inputs, parse on save
  weight: string;
  bagCount: string;
  overrideReason: string;
  defectNotes: string;
  specialRequest: string;
  remark: string;
};
