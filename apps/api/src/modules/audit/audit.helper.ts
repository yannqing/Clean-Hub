import { auditLogs, type Database } from "@cleanhub/db";

type AuditPayload = Record<string, unknown>;
export type AuditLogWriter = Pick<Database, "insert">;

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
  before?: AuditPayload | null;
  after?: AuditPayload | null;
  metadata?: AuditPayload;
  ipAddress?: string;
  userAgent?: string;
};

const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "hash",
];

function isSensitiveAuditKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: AuditPayload = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveAuditKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeAuditValue(nestedValue);
  }

  return sanitized;
}

export function sanitizeAuditPayload(
  payload: AuditPayload | null | undefined,
): AuditPayload | null | undefined {
  if (payload == null) {
    return payload;
  }

  return sanitizeAuditValue(payload) as AuditPayload;
}

export async function writeAuditLog(
  db: AuditLogWriter,
  input: WriteAuditLogInput,
): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId ?? null,
    branchId: input.branchId ?? null,
    actorUserId: input.actorUserId ?? null,
    eventCategory: input.eventCategory,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    success: input.success ?? true,
    reason: input.reason,
    before: sanitizeAuditPayload(input.before),
    after: sanitizeAuditPayload(input.after),
    metadata: sanitizeAuditPayload(input.metadata),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
