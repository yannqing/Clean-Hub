import { and, eq, isNull, sql } from "drizzle-orm";

import {
  hardwareConfigs,
  paymentTransactions,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

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
    provisioningMode: row.provisioningMode,
    hardwareKey: row.hardwareKey,
    config: (row.config as Record<string, unknown>) ?? {},
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export async function upsertBuiltInHardwareDeviceRecord(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
    hardwareKey: string;
    name: string;
    deviceType: "printer" | "scanner";
    config: Record<string, unknown>;
    actorUserId: string | null;
  },
): Promise<PosHardwareDeviceSummary> {
  const now = new Date();
  const legacyIdentity =
    input.hardwareKey === "t1101:built-in:printer"
      ? sql`${hardwareConfigs.config}->>'printerId' = 't1101:built-in'`
      : input.hardwareKey === "t1101:built-in:scanner"
        ? sql`${hardwareConfigs.config}->>'scannerId' = 't1101:built-in'`
        : undefined;
  const exactMatch = await db
    .select({ id: hardwareConfigs.id })
    .from(hardwareConfigs)
    .where(
      and(
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.terminalId, input.terminalId),
        eq(hardwareConfigs.hardwareKey, input.hardwareKey),
      ),
    )
    .limit(1);
  const legacyMatch =
    exactMatch.length === 0 && legacyIdentity
      ? await db
          .select({ id: hardwareConfigs.id })
          .from(hardwareConfigs)
          .where(
            and(
              eq(hardwareConfigs.tenantId, input.tenantId),
              eq(hardwareConfigs.terminalId, input.terminalId),
              legacyIdentity,
            ),
          )
          .limit(1)
      : [];
  const existing = exactMatch[0] ?? legacyMatch[0];

  if (existing) {
    const revived = await db
      .update(hardwareConfigs)
      .set({
        hardwareKey: input.hardwareKey,
        name: input.name,
        deviceType: input.deviceType,
        connectionType: "other",
        provisioningMode: "built_in",
        config: input.config,
        status: "active",
        deletedAt: null,
        deletedBy: null,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${hardwareConfigs.version} + 1`,
      })
      .where(
        and(
          eq(hardwareConfigs.id, existing.id),
          eq(hardwareConfigs.tenantId, input.tenantId),
          eq(hardwareConfigs.terminalId, input.terminalId),
        ),
      )
      .returning();
    if (revived[0]) return toSummary(revived[0]);
  }

  const rows = await db
    .insert(hardwareConfigs)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      terminalId: input.terminalId,
      hardwareKey: input.hardwareKey,
      name: input.name,
      deviceType: input.deviceType,
      connectionType: "other",
      provisioningMode: "built_in",
      config: input.config,
      status: "active",
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: [
        hardwareConfigs.tenantId,
        hardwareConfigs.terminalId,
        hardwareConfigs.hardwareKey,
      ],
      set: {
        name: input.name,
        deviceType: input.deviceType,
        connectionType: "other",
        provisioningMode: "built_in",
        config: input.config,
        status: "active",
        deletedAt: null,
        deletedBy: null,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${hardwareConfigs.version} + 1`,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error("Built-in hardware registration did not return a record.");
  }
  return toSummary(row);
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

export async function clearDefaultPosPrinterBindings(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
    hardwareId: string;
    printerPurpose: "receipt" | "label";
    actorUserId: string | null;
  },
): Promise<void> {
  await db
    .update(hardwareConfigs)
    .set({
      config: sql`${hardwareConfigs.config} - 'printerIsDefault'`,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${hardwareConfigs.version} + 1`,
    })
    .where(
      and(
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.terminalId, input.terminalId),
        eq(hardwareConfigs.deviceType, "printer"),
        eq(hardwareConfigs.status, "active"),
        sql`${hardwareConfigs.id} <> ${input.hardwareId}`,
        sql`${hardwareConfigs.config}->>'printerPurpose' = ${input.printerPurpose}`,
        sql`${hardwareConfigs.config}->>'printerIsDefault' = 'true'`,
        isNull(hardwareConfigs.deletedAt),
      ),
    );
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
