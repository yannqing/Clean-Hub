import { and, eq, isNull } from "drizzle-orm";

import { hardwareConfigs, type Database } from "@cleanhub/db";

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
  };
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
