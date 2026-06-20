/**
 * POS reception (front-desk) — DTOs.
 *
 * Covers customer walk-in intake, drop-off/pickup confirmation at the counter,
 * and the daily reception log. Scaffold only; no db tables yet.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosReceptionEventType =
  | "walk_in"
  | "drop_off"
  | "pickup"
  | "inquiry"
  | "complaint";

export type PosReceptionEvent = {
  id: string;
  type: PosReceptionEventType;
  customerId: string | null;
  customerName: string;
  orderId: string | null;
  ticketId: string | null;
  servedByStaffId: string;
  notes: string | null;
  createdAt: string;
};

export type PosReceptionEventListQuery = {
  type?: PosReceptionEventType;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export type CreatePosReceptionEventRequest = {
  type: PosReceptionEventType;
  customerId?: string;
  customerName: string;
  orderId?: string;
  ticketId?: string;
  notes?: string;
};

export type PosReceptionSummary = {
  branchId: string;
  date: string;
  totalEvents: number;
  byType: Record<PosReceptionEventType, number>;
};

export type PosReceptionEventListInput = {
  authContext: AuthContext;
  query: PosReceptionEventListQuery;
};

export type CreatePosReceptionEventInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosReceptionEventRequest;
};

export type PosReceptionSummaryInput = {
  authContext: AuthContext;
  date?: string;
};
