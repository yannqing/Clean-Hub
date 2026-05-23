import { and, desc, eq, gte, lte } from "drizzle-orm";

import { operationLogs, type Database } from "@cleanhub/db";

import type {
  OperationLogListInput,
  OperationLogListItem,
  WriteOperationLogInput,
} from "./operation-logs.types.js";

function toDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

export async function findOperationLogs(
  db: Database,
  input: OperationLogListInput,
): Promise<OperationLogListItem[]> {
  const dateFrom = toDate(input.dateFrom);
  const dateTo = toDate(input.dateTo);

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
      createdAt: operationLogs.createdAt,
    })
    .from(operationLogs)
    .where(
      and(
        input.level ? eq(operationLogs.level, input.level) : undefined,
        input.service ? eq(operationLogs.service, input.service) : undefined,
        input.tenantId ? eq(operationLogs.tenantId, input.tenantId) : undefined,
        dateFrom ? gte(operationLogs.createdAt, dateFrom) : undefined,
        dateTo ? lte(operationLogs.createdAt, dateTo) : undefined,
      ),
    )
    .orderBy(desc(operationLogs.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
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
