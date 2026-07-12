import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";

import { createId } from "@cleanhub/id";
import { hardwareConfigs, type Database } from "@cleanhub/db";

import type {
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceStatus,
  HardwareDeviceType,
  ListHardwareConfigsQuery,
} from "./hardware.types.js";
import { HardwareError } from "./hardware.errors.js";

function toHardwareConfigSummary(row: {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  deviceType: HardwareDeviceType;
  connectionType: HardwareConnectionType;
  config: Record<string, unknown>;
  status: HardwareDeviceStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): HardwareConfigSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    name: row.name,
    deviceType: row.deviceType,
    connectionType: row.connectionType,
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
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    eq(hardwareConfigs.tenantId, tenantId),
    isNull(hardwareConfigs.deletedAt),
    query.branchId ? eq(hardwareConfigs.branchId, query.branchId) : undefined,
    query.deviceType ? eq(hardwareConfigs.deviceType, query.deviceType) : undefined,
    query.status ? eq(hardwareConfigs.status, query.status) : undefined,
  ];

  return and(...conditions);
}

export async function findHardwareConfigs(
  db: Database,
  tenantId: string,
  query: ListHardwareConfigsQuery,
): Promise<HardwareConfigSummary[]> {
  const rows = await db
    .select({
      id: hardwareConfigs.id,
      tenantId: hardwareConfigs.tenantId,
      branchId: hardwareConfigs.branchId,
      name: hardwareConfigs.name,
      deviceType: hardwareConfigs.deviceType,
      connectionType: hardwareConfigs.connectionType,
      config: hardwareConfigs.config,
      status: hardwareConfigs.status,
      createdAt: hardwareConfigs.createdAt,
      updatedAt: hardwareConfigs.updatedAt,
      version: hardwareConfigs.version,
    })
    .from(hardwareConfigs)
    .where(buildWhereClause(tenantId, query))
    .orderBy(desc(hardwareConfigs.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  return rows.map(toHardwareConfigSummary);
}

export async function findHardwareConfigById(
  db: Database,
  tenantId: string,
  hardwareId: string,
): Promise<HardwareConfigSummary | null> {
  const rows = await db
    .select({
      id: hardwareConfigs.id,
      tenantId: hardwareConfigs.tenantId,
      branchId: hardwareConfigs.branchId,
      name: hardwareConfigs.name,
      deviceType: hardwareConfigs.deviceType,
      connectionType: hardwareConfigs.connectionType,
      config: hardwareConfigs.config,
      status: hardwareConfigs.status,
      createdAt: hardwareConfigs.createdAt,
      updatedAt: hardwareConfigs.updatedAt,
      version: hardwareConfigs.version,
    })
    .from(hardwareConfigs)
    .where(
      and(
        eq(hardwareConfigs.id, hardwareId),
        eq(hardwareConfigs.tenantId, tenantId),
        isNull(hardwareConfigs.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return toHardwareConfigSummary(row);
}

export type InsertHardwareConfigInput = {
  tenantId: string;
  branchId: string;
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

  const rows = await db
    .insert(hardwareConfigs)
    .values({
      id,
      tenantId: input.tenantId,
      branchId: input.branchId,
      name: input.name,
      deviceType: input.deviceType,
      connectionType: input.connectionType,
      config: input.config,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .returning({
      id: hardwareConfigs.id,
      tenantId: hardwareConfigs.tenantId,
      branchId: hardwareConfigs.branchId,
      name: hardwareConfigs.name,
      deviceType: hardwareConfigs.deviceType,
      connectionType: hardwareConfigs.connectionType,
      config: hardwareConfigs.config,
      status: hardwareConfigs.status,
      createdAt: hardwareConfigs.createdAt,
      updatedAt: hardwareConfigs.updatedAt,
      version: hardwareConfigs.version,
    });

  return toHardwareConfigSummary(rows[0]!);
}

export type UpdateHardwareConfigRecordInput = {
  hardwareId: string;
  tenantId: string;
  name?: string;
  branchId?: string;
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
    branchId?: string;
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
  if (input.branchId !== undefined) setValues.branchId = input.branchId;
  if (input.connectionType !== undefined) setValues.connectionType = input.connectionType;
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
    const existing = await findHardwareConfigById(db, input.tenantId, input.hardwareId);

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
    const existing = await findHardwareConfigById(db, input.tenantId, input.hardwareId);

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
