import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { operationLogs, type Database } from "@cleanhub/db";

import type {
  OperationLogDetail,
  OperationLogListInput,
  OperationLogListResult,
  WriteOperationLogInput,
} from "./operation-logs.types.js";

function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function buildWhereClause(input: OperationLogListInput): SQL | undefined {
  const dateFrom = toDate(input.dateFrom);
  const dateTo = toDate(input.dateTo);

  return and(
    input.level ? eq(operationLogs.level, input.level) : undefined,
    input.service ? eq(operationLogs.service, input.service) : undefined,
    input.tenantId ? eq(operationLogs.tenantId, input.tenantId) : undefined,
    dateFrom ? gte(operationLogs.createdAt, dateFrom) : undefined,
    dateTo ? lte(operationLogs.createdAt, dateTo) : undefined,
  );
}

export async function findOperationLogs(
  db: Database,
  input: OperationLogListInput,
): Promise<OperationLogListResult> {
  const whereClause = buildWhereClause(input);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: operationLogs.id,
        tenantId: operationLogs.tenantId,
        branchId: operationLogs.branchId,
        level: operationLogs.level,
        service: operationLogs.service,
        eventType: operationLogs.eventType,
        message: operationLogs.message,
        requestId: operationLogs.requestId,
        actorUserId: operationLogs.actorUserId,
        createdAt: operationLogs.createdAt,
      })
      .from(operationLogs)
      .where(whereClause)
      .orderBy(desc(operationLogs.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ value: count() }).from(operationLogs).where(whereClause),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total: totalRows[0]?.value ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function findOperationLogById(
  db: Database,
  logId: string,
): Promise<OperationLogDetail | null> {
  const rows = await db
    .select({
      id: operationLogs.id,
      tenantId: operationLogs.tenantId,
      branchId: operationLogs.branchId,
      level: operationLogs.level,
      service: operationLogs.service,
      eventType: operationLogs.eventType,
      message: operationLogs.message,
      requestId: operationLogs.requestId,
      actorUserId: operationLogs.actorUserId,
      metadata: operationLogs.metadata,
      createdAt: operationLogs.createdAt,
    })
    .from(operationLogs)
    .where(eq(operationLogs.id, logId))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertOperationLog(
  db: Database,
  input: WriteOperationLogInput,
): Promise<void> {
  await db.insert(operationLogs).values({
    tenantId: input.tenantId,
    branchId: input.branchId,
    level: input.level ?? "info",
    service: input.service,
    eventType: input.eventType,
    message: input.message,
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    metadata: input.metadata,
  });
}
