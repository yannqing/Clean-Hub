export type PosStaffRole = "owner" | "manager" | "cashier";
export type PosStaffStatus = "on_duty" | "off_duty" | "on_break";
export type PosShiftStatus = "open" | "on_break" | "closed";

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

export type PosStaffListResponse = { data: PosStaffSummary[] };
export type ClockAction =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end";
export type ClockRequest = {
  action: ClockAction;
  openingFloat?: string;
  closingFloat?: string;
};

export type ShiftRecord = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
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

export type PosZReportPaymentBreakdown = {
  method: string;
  provider: string | null;
  grossAmount: string;
  refundAmount: string;
  netAmount: string;
  transactionCount: number;
};

export type PosZReport = {
  id: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  shiftId: string;
  handoverId: string;
  currency: string;
  cutoffAt: string;
  orderCount: number;
  grossSales: string;
  discountAmount: string;
  refundAmount: string;
  correctionAmount: string;
  netSales: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  outstandingOrders: number;
  paymentBreakdown: PosZReportPaymentBreakdown[];
  createdAt: string;
};

export type PosZReportListQuery = { limit?: number; offset?: number };
export type PosZReportListResponse = { data: PosZReport[] };

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
