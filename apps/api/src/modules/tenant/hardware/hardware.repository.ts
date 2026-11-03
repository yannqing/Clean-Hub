import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { createId } from "@cleanhub/id";
import {
  hardwareConfigs,
  posTerminalSettings,
  type Database,
} from "@cleanhub/db";

import type {
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceStatus,
  HardwareDeviceType,
  HardwareProvisioningMode,
  ListHardwareConfigsQuery,
} from "./hardware.types.js";
import { HardwareError } from "./hardware.errors.js";

function toHardwareConfigSummary(row: {
  id: string;
  tenantId: string;
  terminalId: string;
  terminalLabel: string | null;
  terminalDeviceId: string;
  branchId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  provisioningMode: HardwareProvisioningMode;
  hardwareKey: string | null;
  config: Record<string, unknown>;
  status: HardwareDeviceStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): HardwareConfigSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    terminalId: row.terminalId,
    terminalLabel: row.terminalLabel,
    terminalDeviceId: row.terminalDeviceId,
    branchId: row.branchId,
    name: row.name,
    deviceType: row.deviceType,
    connectionType: row.connectionType,
    provisioningMode: row.provisioningMode,
    hardwareKey: row.hardwareKey,
    config: row.config,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function buildWhereClause(
  tenantId: string,
  query: ListHardwareConfigsQuery,
  allowedBranchIds?: string[],
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    eq(hardwareConfigs.tenantId, tenantId),
    isNull(hardwareConfigs.deletedAt),
    query.terminalId
      ? eq(hardwareConfigs.terminalId, query.terminalId)
      : undefined,
    query.deviceType
      ? eq(hardwareConfigs.deviceType, query.deviceType)
      : undefined,
    query.status ? eq(hardwareConfigs.status, query.status) : undefined,
    buildBranchScopeCondition(allowedBranchIds),
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

  return inArray(posTerminalSettings.branchId, allowedBranchIds);
}

export async function findHardwareConfigs(
  db: Database,
  tenantId: string,
  query: ListHardwareConfigsQuery,
  allowedBranchIds?: string[],
): Promise<HardwareConfigSummary[]> {
  const rows = await db
    .select({
      id: hardwareConfigs.id,
      tenantId: hardwareConfigs.tenantId,
      terminalId: hardwareConfigs.terminalId,
      terminalLabel: posTerminalSettings.label,
      terminalDeviceId: posTerminalSettings.deviceId,
      branchId: posTerminalSettings.branchId,
      name: hardwareConfigs.name,
      deviceType: hardwareConfigs.deviceType,
      connectionType: hardwareConfigs.connectionType,
      provisioningMode: hardwareConfigs.provisioningMode,
      hardwareKey: hardwareConfigs.hardwareKey,
      config: hardwareConfigs.config,
      status: hardwareConfigs.status,
      createdAt: hardwareConfigs.createdAt,
      updatedAt: hardwareConfigs.updatedAt,
      version: hardwareConfigs.version,
    })
    .from(hardwareConfigs)
    .innerJoin(
      posTerminalSettings,
      and(
        eq(posTerminalSettings.id, hardwareConfigs.terminalId),
        eq(posTerminalSettings.tenantId, hardwareConfigs.tenantId),
      ),
    )
    .where(buildWhereClause(tenantId, query, allowedBranchIds))
    .orderBy(desc(hardwareConfigs.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map(toHardwareConfigSummary);
}

export async function findHardwareConfigById(
  db: Database,
  tenantId: string,
  hardwareId: string,
  allowedBranchIds?: string[],
): Promise<HardwareConfigSummary | null> {
  const rows = await db
    .select({
      id: hardwareConfigs.id,
      tenantId: hardwareConfigs.tenantId,
      terminalId: hardwareConfigs.terminalId,
      terminalLabel: posTerminalSettings.label,
      terminalDeviceId: posTerminalSettings.deviceId,
      branchId: posTerminalSettings.branchId,
      name: hardwareConfigs.name,
      deviceType: hardwareConfigs.deviceType,
      connectionType: hardwareConfigs.connectionType,
      provisioningMode: hardwareConfigs.provisioningMode,
      hardwareKey: hardwareConfigs.hardwareKey,
      config: hardwareConfigs.config,
      status: hardwareConfigs.status,
      createdAt: hardwareConfigs.createdAt,
      updatedAt: hardwareConfigs.updatedAt,
      version: hardwareConfigs.version,
    })
    .from(hardwareConfigs)
    .innerJoin(
      posTerminalSettings,
      and(
        eq(posTerminalSettings.id, hardwareConfigs.terminalId),
        eq(posTerminalSettings.tenantId, hardwareConfigs.tenantId),
      ),
    )
    .where(
      and(
        eq(hardwareConfigs.id, hardwareId),
        eq(hardwareConfigs.tenantId, tenantId),
        isNull(hardwareConfigs.deletedAt),
        buildBranchScopeCondition(allowedBranchIds),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return toHardwareConfigSummary(row);
}

export async function findHardwareTerminal(
  db: Database,
  tenantId: string,
  terminalId: string,
): Promise<{ id: string; branchId: string } | null> {
  const rows = await db
    .select({
      id: posTerminalSettings.id,
      branchId: posTerminalSettings.branchId,
    })
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, terminalId),
        eq(posTerminalSettings.tenantId, tenantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export type InsertHardwareConfigInput = {
  tenantId: string;
  terminalId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config: Record<string, unknown>;
  actorUserId: string | null;
};

export async function insertHardwareConfig(
  db: Database,
  input: InsertHardwareConfigInput,
): Promise<HardwareConfigSummary> {
  const id = createId();

  await db.insert(hardwareConfigs).values({
    id,
    tenantId: input.tenantId,
    terminalId: input.terminalId,
    name: input.name,
    deviceType: input.deviceType,
    connectionType: input.connectionType,
    config: input.config,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  return (await findHardwareConfigById(db, input.tenantId, id))!;
}

export type UpdateHardwareConfigRecordInput = {
  hardwareId: string;
  tenantId: string;
  name?: string;
  terminalId?: string;
  connectionType?: HardwareConnectionType;
  config?: Record<string, unknown>;
  status?: HardwareDeviceStatus;
  version: number;
  actorUserId: string | null;
};

export async function updateHardwareConfigRecord(
  db: Database,
  input: UpdateHardwareConfigRecordInput,
): Promise<void> {
  type UpdateSet = {
    updatedAt: Date;
    updatedBy: string | null;
    version: SQL;
    name?: string;
    terminalId?: string;
    connectionType?: HardwareConnectionType;
    config?: Record<string, unknown>;
    status?: HardwareDeviceStatus;
  };

  const setValues: UpdateSet = {
    updatedAt: new Date(),
    updatedBy: input.actorUserId,
    version: sql`${hardwareConfigs.version} + 1`,
  };

  if (input.name !== undefined) setValues.name = input.name;
  if (input.terminalId !== undefined) setValues.terminalId = input.terminalId;
  if (input.connectionType !== undefined)
    setValues.connectionType = input.connectionType;
  if (input.config !== undefined) setValues.config = input.config;
  if (input.status !== undefined) setValues.status = input.status;

  const updatedRows = await db
    .update(hardwareConfigs)
    .set(setValues)
    .where(
      and(
        eq(hardwareConfigs.id, input.hardwareId),
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.version, input.version),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .returning({ id: hardwareConfigs.id });

  if (!updatedRows[0]) {
    const existing = await findHardwareConfigById(
      db,
      input.tenantId,
      input.hardwareId,
    );

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    throw new HardwareError(
      "HARDWARE_VERSION_CONFLICT",
      "Hardware config has been modified. Refresh and try again.",
      409,
    );
  }
}

export type SoftDeleteHardwareConfigInput = {
  hardwareId: string;
  tenantId: string;
  version: number;
  actorUserId: string | null;
};

export async function softDeleteHardwareConfig(
  db: Database,
  input: SoftDeleteHardwareConfigInput,
): Promise<void> {
  const updatedRows = await db
    .update(hardwareConfigs)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${hardwareConfigs.version} + 1`,
    })
    .where(
      and(
        eq(hardwareConfigs.id, input.hardwareId),
        eq(hardwareConfigs.tenantId, input.tenantId),
        eq(hardwareConfigs.version, input.version),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .returning({ id: hardwareConfigs.id });

  if (!updatedRows[0]) {
    const existing = await findHardwareConfigById(
      db,
      input.tenantId,
      input.hardwareId,
    );

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    throw new HardwareError(
      "HARDWARE_VERSION_CONFLICT",
      "Hardware config has been modified. Refresh and try again.",
      409,
    );
  }
}
