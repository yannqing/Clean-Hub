/**
 * 店员交接 — local types.
 * Prefer re-exporting DTOs from @cleanhub/api-client so the wire shape stays
 * the single source of truth. Add UI-only types below as needed.
 */
import type {
  PosOrderOverview,
  PosOrderSummary,
  ServiceTicketOverview,
  ServiceTicketSummary,
} from "@cleanhub/api-client";

export type {
  PosStaffSummary,
  PosZReport,
  ShiftRecord,
} from "@cleanhub/api-client";

export type ShiftHandoverSummary = {
  generatedAt: string;
  orders: PosOrderOverview | null;
  tickets: ServiceTicketOverview | null;
  pendingOrders: PosOrderSummary[];
  readyTickets: ServiceTicketSummary[];
  overdueTickets: ServiceTicketSummary[];
  exceptionTickets: ServiceTicketSummary[];
};
