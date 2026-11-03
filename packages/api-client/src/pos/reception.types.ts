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

export type PosReceptionEventListResponse = {
  data: PosReceptionEvent[];
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

export type PosReceptionSummaryQuery = {
  date?: string;
};
