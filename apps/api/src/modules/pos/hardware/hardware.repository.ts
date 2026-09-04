import { and, eq, isNull, sql } from "drizzle-orm";

import {
  hardwareConfigs,
  paymentTransactions,
  type Database,
} from "@cleanhub/db";

import type { PosHardwareDeviceSummary } from "./hardware.types.js";

function toSummary(
  row: typeof hardwareConfigs.$inferSelect,
): PosHardwareDeviceSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    terminalId: row.terminalId,
    name: row.name,
    deviceType: row.deviceType,
    connectionType: row.connectionType,
    config: (row.config as Record<string, unknown>) ?? {},
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export async function findActiveHardwareDeviceForTerminal(
  db: Database,
  input: { tenantId: string; terminalId: string; hardwareId: string },
): Promise<PosHardwareDeviceSummary | null> {
  const rows = await db
    .select()
    .from(hardwareConfigs)
    .where(
      and(
        eq(hardwareConfigs.id, input.hardwareId),
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.terminalId, input.terminalId),
        eq(hardwareConfigs.status, "active"),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function updatePosPrinterBindingRecord(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
    hardwareId: string;
    config: Record<string, unknown>;
    version: number;
    actorUserId: string | null;
  },
): Promise<PosHardwareDeviceSummary | null> {
  const rows = await db
    .update(hardwareConfigs)
    .set({
      config: input.config,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${hardwareConfigs.version} + 1`,
    })
    .where(
      and(
        eq(hardwareConfigs.id, input.hardwareId),
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.terminalId, input.terminalId),
        eq(hardwareConfigs.deviceType, "printer"),
        eq(hardwareConfigs.status, "active"),
        eq(hardwareConfigs.version, input.version),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .returning();

  return rows[0] ? toSummary(rows[0]) : null;
}

/**
 * List active peripherals for a POS terminal.
 * Only returns non-deleted, active devices.
 */
export async function findHardwareDevicesByTerminal(
  db: Database,
  tenantId: string,
  terminalId: string,
): Promise<PosHardwareDeviceSummary[]> {
  const rows = await db
    .select()
    .from(hardwareConfigs)
    .where(
      and(
        eq(hardwareConfigs.tenantId, tenantId),
        eq(hardwareConfigs.terminalId, terminalId),
        eq(hardwareConfigs.status, "active"),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .orderBy(hardwareConfigs.createdAt);

  return rows.map(toSummary);
}

export async function findPaidCashPaymentForBranch(
  db: Database,
  input: { tenantId: string; branchId: string; paymentId: string },
): Promise<{ id: string; orderId: string } | null> {
  const rows = await db
    .select({
      id: paymentTransactions.id,
      orderId: paymentTransactions.orderId,
    })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.id, input.paymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
        eq(paymentTransactions.branchId, input.branchId),
        eq(paymentTransactions.paymentMethod, "cash"),
        eq(paymentTransactions.paymentStatus, "paid"),
        isNull(paymentTransactions.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
