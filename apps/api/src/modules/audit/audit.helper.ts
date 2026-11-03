import { auditLogs, type Database } from "@cleanhub/db";

const SENSITIVE_AUDIT_KEYS = new Set([
  "accessToken",
  "apiKey",
  "authorization",
  "password",
  "passwordHash",
  "pin",
  "pinHash",
  "refreshToken",
  "secret",
  "token",
  "tokenHash",
]);

export type WriteAuditLogInput = {
  actorUserId?: string | null;
  tenantId?: string | null;
  branchId?: string | null;
  eventCategory: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  reason?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

function sanitizeAuditPayload(
  payload?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!payload) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !SENSITIVE_AUDIT_KEYS.has(key))
      .map(([key, value]) => [
        key,
        value && typeof value === "object" && !Array.isArray(value)
          ? sanitizeAuditPayload(value as Record<string, unknown>)
          : value,
      ]),
  );
}

export async function writeAuditLog(
  db: Database,
  input: WriteAuditLogInput,
): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventCategory: input.eventCategory,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    success: input.success ?? true,
    reason: input.reason,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    before: sanitizeAuditPayload(input.before),
    after: sanitizeAuditPayload(input.after),
    metadata: sanitizeAuditPayload(input.metadata),
  });
}
