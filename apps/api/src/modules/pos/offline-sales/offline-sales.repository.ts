import { posOfflineSaleExceptions, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, desc, eq, sql } from "drizzle-orm";

import type {
  PosOfflineCashCommand,
  PosOfflineSaleException,
} from "./offline-sales.types.js";

function toException(
  row: typeof posOfflineSaleExceptions.$inferSelect,
): PosOfflineSaleException {
  return {
    id: row.id,
    commandId: row.commandId,
    orderId: row.orderId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    shiftId: row.shiftId,
    staffId: row.staffId,
    operationType: row.operationType as "checkout" | "payment",
    expectedTotalAmount: row.expectedTotalAmount,
    tenderedAmount: row.tenderedAmount,
    currency: row.currency,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    failureCount: Number(row.failureCount),
    lastFailedAt: row.lastFailedAt.toISOString(),
    status: row.status,
    resolution: row.resolution,
    resolutionReason: row.resolutionReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertOfflineSaleException(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    shiftId: string;
    staffId: string;
    commandId: string;
    orderId: string;
    operationType: "checkout" | "payment";
    expectedTotalAmount: string;
    tenderedAmount: string;
    currency: string;
    command: PosOfflineCashCommand;
    failureCode?: string;
    failureMessage: string;
  },
): Promise<PosOfflineSaleException> {
  const now = new Date();
  const rows = await db
    .insert(posOfflineSaleExceptions)
    .values({
      id: createId(),
      ...input,
      commandPayload: input.command,
      failureCode: input.failureCode,
      lastFailedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        posOfflineSaleExceptions.tenantId,
        posOfflineSaleExceptions.commandId,
      ],
      set: {
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        failureCount: sql`${posOfflineSaleExceptions.failureCount} + 1`,
        lastFailedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return toException(rows[0]!);
}

export async function findOfflineSaleException(
  db: Database,
  input: { tenantId: string; commandId: string; forUpdate?: boolean },
): Promise<{
  exception: PosOfflineSaleException;
  command: PosOfflineCashCommand;
} | null> {
  const query = db
    .select()
    .from(posOfflineSaleExceptions)
    .where(
      and(
        eq(posOfflineSaleExceptions.tenantId, input.tenantId),
        eq(posOfflineSaleExceptions.commandId, input.commandId),
      ),
    );
  const rows = input.forUpdate
    ? await query.for("update").limit(1)
    : await query.limit(1);
  return rows[0]
    ? {
        exception: toException(rows[0]),
        command: rows[0].commandPayload as PosOfflineCashCommand,
      }
    : null;
}

export async function listOfflineSaleExceptions(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    status: "open" | "resolved";
    limit: number;
  },
): Promise<PosOfflineSaleException[]> {
  const rows = await db
    .select()
    .from(posOfflineSaleExceptions)
    .where(
      and(
        eq(posOfflineSaleExceptions.tenantId, input.tenantId),
        eq(posOfflineSaleExceptions.branchId, input.branchId),
        eq(posOfflineSaleExceptions.status, input.status),
      ),
    )
    .orderBy(desc(posOfflineSaleExceptions.createdAt))
    .limit(input.limit);
  return rows.map(toException);
}

export async function resolveOfflineSaleExceptionRecord(
  db: Database,
  input: {
    tenantId: string;
    commandId: string;
    resolution: "cash_refunded" | "recovered";
    reason: string;
    actorUserId: string;
  },
): Promise<PosOfflineSaleException | null> {
  const now = new Date();
  const rows = await db
    .update(posOfflineSaleExceptions)
    .set({
      status: "resolved",
      resolution: input.resolution,
      resolutionReason: input.reason,
      resolvedAt: now,
      resolvedBy: input.actorUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(posOfflineSaleExceptions.tenantId, input.tenantId),
        eq(posOfflineSaleExceptions.commandId, input.commandId),
      ),
    )
    .returning();
  return rows[0] ? toException(rows[0]) : null;
}
