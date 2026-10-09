export type TenantAuditLogSummary = {
  id: string;
  tenantId: string | null;
  branchId?: string | null;
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

export type TenantAuditLogDetail = TenantAuditLogSummary & {
  branchId: string | null;
  userAgent: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type TenantAuditLogListResult = {
  items: TenantAuditLogSummary[];
  total: number;
};

export type TenantAuditLogListFilters = {
  eventCategory?: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  branchId?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};
