import { and, desc, eq, gte, lte } from "drizzle-orm";

import { securityEvents, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  SecurityEventListInput,
  SecurityEventListItem,
  WriteSecurityEventInput,
} from "./security-events.types.js";

function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

export async function findSecurityEvents(
  db: Database,
  input: SecurityEventListInput,
): Promise<SecurityEventListItem[]> {
  const dateFrom = toDate(input.dateFrom);
  const dateTo = toDate(input.dateTo);

  const rows = await db
    .select({
      id: securityEvents.id,
      tenantId: securityEvents.tenantId,
      branchId: securityEvents.branchId,
      actorUserId: securityEvents.actorUserId,
      eventType: securityEvents.eventType,
      severity: securityEvents.severity,
      ipAddress: securityEvents.ipAddress,
      description: securityEvents.description,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .where(
      and(
        input.severity ? eq(securityEvents.severity, input.severity) : undefined,
        input.eventType ? eq(securityEvents.eventType, input.eventType) : undefined,
        input.tenantId ? eq(securityEvents.tenantId, input.tenantId) : undefined,
        dateFrom ? gte(securityEvents.createdAt, dateFrom) : undefined,
        dateTo ? lte(securityEvents.createdAt, dateTo) : undefined,
      ),
    )
    .orderBy(desc(securityEvents.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function insertSecurityEvent(
  db: Database,
  input: WriteSecurityEventInput,
): Promise<void> {
  await db.insert(securityEvents).values({
    id: createId(),
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    severity: input.severity ?? "medium",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    description: input.description,
    metadata: input.metadata,
  });
}

export async function hasSecurityEvents(db: Database): Promise<boolean> {
  const rows = await db
    .select({ id: securityEvents.id })
    .from(securityEvents)
    .limit(1);

  return rows.length > 0;
}
