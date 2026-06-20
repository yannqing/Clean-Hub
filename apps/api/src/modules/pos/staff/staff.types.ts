/**
 * POS staff management — DTOs.
 *
 * Covers cashier profiles, shift clock-in/out, and shift handover. All shapes
 * are scaffold placeholders; no db tables exist yet (staff/shifts/handovers).
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosStaffRole = "cashier" | "supervisor" | "manager";

export type PosStaffStatus = "on_duty" | "off_duty" | "on_break";

export type PosStaffSummary = {
  id: string;
  displayName: string;
  role: PosStaffRole;
  status: PosStaffStatus;
};

export type PosStaffDetail = PosStaffSummary & {
  email: string | null;
  phone: string | null;
  branchId: string;
  currentShiftId: string | null;
};

export type PosStaffListQuery = {
  role?: PosStaffRole;
  status?: PosStaffStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

/** Clock-in / clock-out request. */
export type ClockAction = "clock_in" | "clock_out" | "break_start" | "break_end";

export type ClockRequest = {
  action: ClockAction;
  deviceId?: string;
};

export type ShiftRecord = {
  id: string;
  staffId: string;
  startedAt: string;
  endedAt: string | null;
  openingFloat: string;
  closingFloat: string | null;
};

/** Handover from the outgoing shift to the incoming one. */
export type CreateHandoverRequest = {
  incomingStaffId: string;
  cashCounted: string;
  notes?: string;
  outstandingTickets: number;
};

export type HandoverRecord = {
  id: string;
  outgoingStaffId: string;
  incomingStaffId: string;
  cashCounted: string;
  outstandingTickets: number;
  notes: string | null;
  createdAt: string;
};

export type PosStaffListInput = {
  authContext: AuthContext;
  query: PosStaffListQuery;
};

export type PosStaffDetailInput = {
  authContext: AuthContext;
  staffId: string;
};

export type ClockInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: ClockRequest;
};

export type CreateHandoverInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreateHandoverRequest;
};
