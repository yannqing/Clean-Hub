export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";

export type SecurityEventListQuery = {
  severity?: SecurityEventSeverity;
  eventType?: string;
  tenantId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type SecurityEventListItem = {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  actorUserId: string | null;
  eventType: string;
  severity: SecurityEventSeverity;
  ipAddress: string | null;
  description: string | null;
  createdAt: string;
};
