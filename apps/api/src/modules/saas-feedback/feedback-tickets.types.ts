export type FeedbackTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export type FeedbackTicketListInput = {
  status?: FeedbackTicketStatus;
  priority?: string;
  tenantId?: string;
  assigneeUserId?: string;
  limit: number;
  offset: number;
};

export type FeedbackTicketListItem = {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  title: string;
  status: FeedbackTicketStatus;
  priority: string;
  source: string | null;
  reporterUserId: string | null;
  assigneeUserId: string | null;
  createdAt: string;
  updatedAt: string;
};
