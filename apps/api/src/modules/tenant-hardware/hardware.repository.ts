import { and, desc, eq, isNull, type SQL } from "drizzle-orm";

import { createId } from "@cleanhub/id";
import { hardwareConfigs, type Database } from "@cleanhub/db";

import type {
  HardwareConfigSummary,
  HardwareConnectionType,
  HardwareDeviceStatus,
  HardwareDeviceType,
  ListHardwareConfigsQuery,
} from "./hardware.types.js";

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
    });

  return toHardwareConfigSummary(rows[0]!);
}

export type UpdateHardwareConfigRecordInput = {
  hardwareId: string;
  tenantId: string;
  name?: string;
  connectionType?: HardwareConnectionType;
  config?: Record<string, unknown>;
  status?: HardwareDeviceStatus;
  actorUserId: string | null;
};

export async function updateHardwareConfigRecord(
  db: Database,
  input: UpdateHardwareConfigRecordInput,
): Promise<void> {
  type UpdateSet = {
    updatedAt: Date;
    updatedBy: string | null;
    name?: string;
    connectionType?: HardwareConnectionType;
    config?: Record<string, unknown>;
    status?: HardwareDeviceStatus;
  };

  const setValues: UpdateSet = {
    updatedAt: new Date(),
    updatedBy: input.actorUserId,
  };

  if (input.name !== undefined) setValues.name = input.name;
  if (input.connectionType !== undefined) setValues.connectionType = input.connectionType;
  if (input.config !== undefined) setValues.config = input.config;
  if (input.status !== undefined) setValues.status = input.status;

  await db
    .update(hardwareConfigs)
    .set(setValues)
    .where(
      and(
        eq(hardwareConfigs.id, input.hardwareId),
        eq(hardwareConfigs.tenantId, input.tenantId),
      ),
    );
}
