import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PosStaffRole = "owner" | "manager" | "cashier";
export type PosStaffStatus = "on_duty" | "off_duty" | "on_break";
export type PosShiftStatus = "open" | "on_break" | "closed";
export type PosCashHandlingMode =
  | "none"
  | "untracked"
  | "shared_drawer"
  | "cash_in_hand";

export type PosStaffSummary = {
  id: string;
  displayName: string;
  role: PosStaffRole;
  status: PosStaffStatus;
  currentShiftId: string | null;
};

export type PosStaffDetail = PosStaffSummary & {
  email: string | null;
  phone: string | null;
  branchId: string;
};

export type PosStaffListQuery = {
  role?: PosStaffRole;
  status?: PosStaffStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type ClockAction =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end";

export type ClockRequest = {
  action: ClockAction;
};

export type ShiftRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string | null;
  staffId: string;
  currency: string;
  status: PosShiftStatus;
  startedAt: string;
  endedAt: string | null;
  openingFloat: string;
  closingFloat: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosShiftCashMovement = {
  id: string;
  shiftId: string | null;
  registerSessionId: string | null;
  cashDrawerSessionId: string | null;
  movementType: "pay_in" | "pay_out";
  amount: string;
  currency: string;
  reason: string;
  idempotencyKey: string;
  createdAt: string;
  createdBy: string;
};

export type CreatePosShiftCashMovementRequest = {
  movementType: "pay_in" | "pay_out";
  amount: string;
  reason: string;
  idempotencyKey: string;
};

export type PosZReportPaymentBreakdown = {
  method: string;
  provider: string | null;
  grossAmount: string;
  refundAmount: string;
  netAmount: string;
  transactionCount: number;
};

export type PosCurrentShiftReconciliation = {
  currency: string;
  orderCount: number;
  grossSales: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  taxComponents: Array<{ name: string; rate: string; taxableAmount: string; taxAmount: string }>;
  refundAmount: string;
  correctionAmount: string;
  unsettledPaymentCount: number;
  unsettledPaymentAmount: string;
  unsettledRefundCount: number;
  unsettledRefundAmount: string;
  netSales: string;
  expectedCash: string;
  outstandingOrders: number;
  outstandingTickets: number;
  paymentBreakdown: PosZReportPaymentBreakdown[];
};

export type PosRegisterSession = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  currency: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  closeNotes: string | null;
  version: number;
};

export type PosCashDrawerSession = {
  id: string;
  registerSessionId: string;
  handlingMode: Exclude<PosCashHandlingMode, "none" | "untracked">;
  assignedStaffId: string | null;
  currency: string;
  status: "open" | "closed";
  openingFloat: string;
  expectedCash: string | null;
  countedCash: string | null;
  variance: string | null;
  openedAt: string;
  closedAt: string | null;
  version: number;
};

export type PosRegisterState = {
  registerSession: PosRegisterSession | null;
  cashSession: PosCashDrawerSession | null;
  cashHandlingMode: PosCashHandlingMode;
  cashTrackingEnabled: boolean;
  requireOpeningFloat: boolean;
  requireClosingCount: boolean;
};

export type OpenPosRegisterRequest = { openingFloat?: string };
export type ClosePosRegisterRequest = {
  countedCash?: string;
  notes?: string;
};
export type ClosePosRegisterResult = {
  registerSession: PosRegisterSession;
  cashSession: PosCashDrawerSession | null;
  zReport: PosZReport | null;
  registerClosed: boolean;
};

export type PosZReport = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  shiftId: string | null;
  handoverId: string | null;
  registerSessionId: string | null;
  currency: string;
  cutoffAt: string;
  orderCount: number;
  grossSales: string;
  discountAmount: string;
  taxableAmount: string | null;
  taxAmount: string | null;
  taxComponents: Array<{ name: string; rate: string; taxableAmount: string; taxAmount: string }>;
  refundAmount: string;
  correctionAmount: string;
  unsettledPaymentCount: number;
  unsettledPaymentAmount: string;
  unsettledRefundCount: number;
  unsettledRefundAmount: string;
  netSales: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  outstandingOrders: number;
  paymentBreakdown: PosZReportPaymentBreakdown[];
  createdAt: string;
};

export type CreateHandoverRequest = {
  incomingStaffId: string;
  countedCash: string;
  notes?: string;
};

export type HandoverRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  outgoingShiftId: string;
  outgoingStaffId: string;
  incomingStaffId: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  outstandingOrders: number;
  outstandingTickets: number;
  notes: string | null;
  cutoffAt: string;
  createdAt: string;
  zReport: PosZReport;
};

export type PosZReportListQuery = {
  limit?: number;
  offset?: number;
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

export type CreatePosShiftCashMovementInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreatePosShiftCashMovementRequest;
};
