export type TenantAuditLogSummary = {
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
