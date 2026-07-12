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

export type { ShiftRecord } from "@cleanhub/api-client";

export type ShiftHandoverSummary = {
  generatedAt: string;
  orders: PosOrderOverview | null;
  tickets: ServiceTicketOverview | null;
  pendingOrders: PosOrderSummary[];
  readyTickets: ServiceTicketSummary[];
  overdueTickets: ServiceTicketSummary[];
  exceptionTickets: ServiceTicketSummary[];
};

export type LocalShiftHandoverRecord = {
  id: string;
  createdAt: string;
  cashierName: string;
  branchName: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  pendingOrderCount: number;
  overdueTicketCount: number;
  exceptionTicketCount: number;
  incomingStaffName: string | null;
  notes: string | null;
};
