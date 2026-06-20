/**
 * POS ticket (work order) management — DTOs.
 *
 * NOTE: scaffold only. No `tickets` table exists yet in packages/db; field
 * shapes are placeholders pending schema design.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

/**
 * Ticket lifecycle mirrors a work order through the store: created at intake,
 * tracked through processing, handed back to the customer at delivery.
 */
export type PosTicketStatus =
  | "open"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export type PosTicketSummary = {
  id: string;
  ticketNumber: string;
  orderId: string | null;
  customerName: string;
  status: PosTicketStatus;
  createdAt: string;
};

export type PosTicketDetail = PosTicketSummary & {
  itemCount: number;
  notes: string | null;
  dueAt: string | null;
  deliveredAt: string | null;
};

export type PosTicketListQuery = {
  status?: PosTicketStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type CreatePosTicketRequest = {
  orderId?: string;
  customerName: string;
  itemCount: number;
  notes?: string;
  dueAt?: string;
};

export type UpdatePosTicketStatusRequest = {
  status: PosTicketStatus;
};

export type PosTicketListInput = {
  authContext: AuthContext;
  query: PosTicketListQuery;
};

export type PosTicketDetailInput = {
  authContext: AuthContext;
  ticketId: string;
};

export type CreatePosTicketInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosTicketRequest;
};

export type UpdatePosTicketStatusInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  ticketId: string;
  data: UpdatePosTicketStatusRequest;
};
