import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { auditLogs, type Database } from "@cleanhub/db";

import type {
  AuditLogDetail,
  AuditLogListItem,
  ListAuditLogsQuery,
  ListAuditLogsResult,
} from "./audit.types.js";

function toAuditLogListItem(row: {
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
  createdAt: Date;
}): AuditLogListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    eventCategory: row.eventCategory,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    success: row.success,
    reason: row.reason,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildWhereClause(query: ListAuditLogsQuery): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    query.actorUserId ? eq(auditLogs.actorUserId, query.actorUserId) : undefined,
    query.eventCategory ? eq(auditLogs.eventCategory, query.eventCategory) : undefined,
    query.eventType ? eq(auditLogs.eventType, query.eventType) : undefined,
    query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLogs.entityId, query.entityId) : undefined,
    query.success !== undefined ? eq(auditLogs.success, query.success) : undefined,
    query.dateFrom ? gte(auditLogs.createdAt, new Date(query.dateFrom)) : undefined,
    query.dateTo ? lte(auditLogs.createdAt, new Date(query.dateTo)) : undefined,
  ];

  return and(...conditions);
}

export async function findAuditLogs(
  db: Database,
  query: ListAuditLogsQuery,
): Promise<ListAuditLogsResult> {
  const whereClause = buildWhereClause(query);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        actorUserId: auditLogs.actorUserId,
        eventCategory: auditLogs.eventCategory,
        eventType: auditLogs.eventType,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        success: auditLogs.success,
        reason: auditLogs.reason,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    items: rows.map(toAuditLogListItem),
    total: totalRows[0]?.value ?? 0,
  };
}

export async function findAuditLogById(
  db: Database,
  logId: string,
): Promise<AuditLogDetail | null> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, logId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    actorUserId: row.actorUserId,
    eventCategory: row.eventCategory,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    success: row.success,
    reason: row.reason,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    before: row.before ?? null,
    after: row.after ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
