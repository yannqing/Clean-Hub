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

export type PosTicketListResponse = {
  data: PosTicketSummary[];
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
