import type { AuthContext } from "../auth/auth.types.js";

export type ListTenantAuditLogsQuery = {
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

export type TenantAuditLogListItem = {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  eventCategory: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type TenantAuditLogDetail = TenantAuditLogListItem & {
  branchId: string | null;
  userAgent: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type TenantAuditLogListResult = {
  items: TenantAuditLogListItem[];
  total: number;
};

export type ListTenantAuditLogsInput = {
  authContext: AuthContext;
  query: ListTenantAuditLogsQuery;
};

export type GetTenantAuditLogDetailInput = {
  authContext: AuthContext;
  logId: string;
};
