import { and, eq } from "drizzle-orm";

import { posTerminalSettings, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreatePosTerminalSettingsRequest,
  PosTerminalSettingsSummary,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types.js";

function toSummary(
  row: typeof posTerminalSettings.$inferSelect,
): PosTerminalSettingsSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    deviceId: row.deviceId,
    label: row.label,
    defaultPaymentMethod: row.defaultPaymentMethod,
    roundingRule: row.roundingRule,
    autoPrintReceipt: row.autoPrintReceipt,
    printCopies: row.printCopies,
    lockTimeoutSeconds: row.lockTimeoutSeconds,
    status: row.status,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

export async function findTerminalSettingsByTenantAndDevice(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<PosTerminalSettingsSummary | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.deviceId, deviceId),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function findTerminalSettingsById(
  db: Database,
  tenantId: string,
  id: string,
): Promise<PosTerminalSettingsSummary | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, id),
        eq(posTerminalSettings.tenantId, tenantId),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function insertTerminalSettings(
  db: Database,
  tenantId: string,
  actorUserId: string,
  input: CreatePosTerminalSettingsRequest,
): Promise<PosTerminalSettingsSummary> {
  const id = createId();
  const rows = await db
    .insert(posTerminalSettings)
    .values({
      id,
      tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      label: input.label ?? null,
      defaultPaymentMethod: input.defaultPaymentMethod ?? "cash",
      roundingRule: input.roundingRule ?? "none",
      autoPrintReceipt: input.autoPrintReceipt ?? true,
      printCopies: input.printCopies ?? 1,
      lockTimeoutSeconds: input.lockTimeoutSeconds ?? 300,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .returning();

  return toSummary(rows[0]!);
}

export async function updateTerminalSettingsRecord(
  db: Database,
  tenantId: string,
  id: string,
  actorUserId: string,
  input: UpdatePosTerminalSettingsRequest,
  currentVersion: number,
): Promise<PosTerminalSettingsSummary | null> {
  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: actorUserId,
    version: currentVersion + 1,
  };

  if (input.label !== undefined) setValues.label = input.label;
  if (input.defaultPaymentMethod !== undefined)
    setValues.defaultPaymentMethod = input.defaultPaymentMethod;
  if (input.roundingRule !== undefined) setValues.roundingRule = input.roundingRule;
  if (input.autoPrintReceipt !== undefined)
    setValues.autoPrintReceipt = input.autoPrintReceipt;
  if (input.printCopies !== undefined) setValues.printCopies = input.printCopies;
  if (input.lockTimeoutSeconds !== undefined)
    setValues.lockTimeoutSeconds = input.lockTimeoutSeconds;

  const rows = await db
    .update(posTerminalSettings)
    .set(setValues)
    .where(
      and(
        eq(posTerminalSettings.id, id),
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.version, currentVersion),
      ),
    )
    .returning();

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function updateTerminalLastSeen(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<void> {
  await db
    .update(posTerminalSettings)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.deviceId, deviceId),
      ),
    );
}
