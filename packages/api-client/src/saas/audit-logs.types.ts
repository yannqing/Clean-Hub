export type AuditLogSummary = {
  id: string;
  eventCategory: string;
  eventType: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  success: boolean;
  reason?: string | null;
  createdAt: string;
};
