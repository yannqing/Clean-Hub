import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { auditLogs, type Database, userProfiles } from "@cleanhub/db";

import type {
  ListTenantAuditLogsQuery,
  TenantAuditLogDetail,
  TenantAuditLogListItem,
  TenantAuditLogListResult,
} from "./audit.types.js";

function toTenantAuditLogListItem(row: {
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
  createdAt: Date;
}): TenantAuditLogListItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorUserId: row.actorUserId,
    actorDisplayName: row.actorDisplayName,
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

function buildWhereClause(
  tenantId: string,
  query: ListTenantAuditLogsQuery,
  allowedBranchIds?: string[],
): SQL | undefined {
  const branchScopeCondition = buildBranchScopeCondition(allowedBranchIds);

  const conditions: (SQL | undefined)[] = [
    eq(auditLogs.tenantId, tenantId),
    query.actorUserId
      ? eq(auditLogs.actorUserId, query.actorUserId)
      : undefined,
    query.eventCategory
      ? eq(auditLogs.eventCategory, query.eventCategory)
      : undefined,
    query.eventType ? eq(auditLogs.eventType, query.eventType) : undefined,
    query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLogs.entityId, query.entityId) : undefined,
    query.branchId ? eq(auditLogs.branchId, query.branchId) : undefined,
    query.success !== undefined
      ? eq(auditLogs.success, query.success)
      : undefined,
    query.dateFrom
      ? gte(auditLogs.createdAt, new Date(query.dateFrom))
      : undefined,
    query.dateTo ? lte(auditLogs.createdAt, new Date(query.dateTo)) : undefined,
    branchScopeCondition,
  ];

  return and(...conditions);
}

function buildBranchScopeCondition(
  allowedBranchIds?: string[],
): SQL | undefined {
  if (allowedBranchIds === undefined) {
    return undefined;
  }

  if (allowedBranchIds.length === 0) {
    return sql`false`;
  }

  return inArray(auditLogs.branchId, allowedBranchIds);
}

export async function findTenantAuditLogs(
  db: Database,
  tenantId: string,
  query: ListTenantAuditLogsQuery,
  allowedBranchIds?: string[],
): Promise<TenantAuditLogListResult> {
  const whereClause = buildWhereClause(tenantId, query, allowedBranchIds);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        actorUserId: auditLogs.actorUserId,
        actorDisplayName: userProfiles.displayName,
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
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, auditLogs.actorUserId),
          eq(userProfiles.tenantId, tenantId),
        ),
      )
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ value: count() }).from(auditLogs).where(whereClause),
  ]);

  return {
    items: rows.map(toTenantAuditLogListItem),
    total: totalRows[0]?.value ?? 0,
  };
}

export async function findTenantAuditLogById(
  db: Database,
  tenantId: string,
  logId: string,
  allowedBranchIds?: string[],
): Promise<TenantAuditLogDetail | null> {
  const rows = await db
    .select({
      id: auditLogs.id,
      tenantId: auditLogs.tenantId,
      branchId: auditLogs.branchId,
      actorUserId: auditLogs.actorUserId,
      actorDisplayName: userProfiles.displayName,
      eventCategory: auditLogs.eventCategory,
      eventType: auditLogs.eventType,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      success: auditLogs.success,
      reason: auditLogs.reason,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      before: auditLogs.before,
      after: auditLogs.after,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(
      userProfiles,
      and(
        eq(userProfiles.userId, auditLogs.actorUserId),
        eq(userProfiles.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(auditLogs.id, logId),
        eq(auditLogs.tenantId, tenantId),
        buildBranchScopeCondition(allowedBranchIds),
      ),
    )
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
    actorDisplayName: row.actorDisplayName,
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
