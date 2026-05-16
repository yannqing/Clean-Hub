import { and, desc, eq, gte, lte } from "drizzle-orm";

import { securityEvents, type Database } from "@cleanhub/db";

import type {
  SecurityEventListInput,
  SecurityEventListItem,
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
