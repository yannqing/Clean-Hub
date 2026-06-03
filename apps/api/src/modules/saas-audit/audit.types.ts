import type { AuthContext } from "../auth/auth.types.js";

export type ListAuditLogsQuery = {
  tenantId?: string;
  actorUserId?: string;
  eventCategory?: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
};

export type AuditLogListItem = {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  eventCategory: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditLogDetail = AuditLogListItem & {
  branchId: string | null;
  userAgent: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type ListAuditLogsResult = {
  items: AuditLogListItem[];
  total: number;
};

export type ListAuditLogsInput = {
  authContext: AuthContext;
  query: ListAuditLogsQuery;
};

export type GetAuditLogDetailInput = {
  authContext: AuthContext;
  logId: string;
};
