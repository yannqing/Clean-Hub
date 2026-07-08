import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import { requireTenantRole } from "../../auth/permission.helper.js";
import { HardwareError } from "./hardware.errors.js";
import {
  findHardwareConfigById,
  findHardwareConfigs,
  insertHardwareConfig,
  softDeleteHardwareConfig,
  updateHardwareConfigRecord,
} from "./hardware.repository.js";
import type {
  CreateHardwareConfigInput,
  DeleteHardwareConfigInput,
  HardwareConfigSummary,
  ListHardwareConfigsInput,
  UpdateHardwareConfigInput,
} from "./hardware.types.js";

export async function listHardwareConfigs(
  input: ListHardwareConfigsInput,
  db: Database = getDb(),
): Promise<HardwareConfigSummary[]> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  return findHardwareConfigs(db, input.authContext.tenantId!, input.query);
}

export async function createHardwareConfig(
  input: CreateHardwareConfigInput,
  db: Database = getDb(),
): Promise<HardwareConfigSummary> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  return db.transaction(async (tx) => {
    const hardware = await insertHardwareConfig(tx, {
      tenantId,
      branchId: input.data.branchId,
      name: input.data.name,
      deviceType: input.data.deviceType,
      connectionType: input.data.connectionType,
      config: input.data.config ?? {},
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.created",
      entityType: "hardware_config",
      entityId: hardware.id,
      after: {
        name: hardware.name,
        deviceType: hardware.deviceType,
        connectionType: hardware.connectionType,
        branchId: hardware.branchId,
        status: hardware.status,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return hardware;
  });
}

export async function updateHardwareConfig(
  input: UpdateHardwareConfigInput,
  db: Database = getDb(),
): Promise<HardwareConfigSummary> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  return db.transaction(async (tx) => {
    const existing = await findHardwareConfigById(tx, tenantId, input.hardwareId);

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    await updateHardwareConfigRecord(tx, {
      hardwareId: input.hardwareId,
      tenantId,
      name: input.data.name,
      branchId: input.data.branchId,
      connectionType: input.data.connectionType,
      config: input.data.config,
      status: input.data.status,
      version: input.data.version,
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.updated",
      entityType: "hardware_config",
      entityId: input.hardwareId,
      before: {
        name: existing.name,
        branchId: existing.branchId,
        connectionType: existing.connectionType,
        config: existing.config,
        status: existing.status,
      },
      after: input.data,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    const updated = await findHardwareConfigById(tx, tenantId, input.hardwareId);

    return updated!;
  });
}

export async function deleteHardwareConfig(
  input: DeleteHardwareConfigInput,
  db: Database = getDb(),
): Promise<void> {
  requireTenantRole(input.authContext, ["owner", "manager"]);

  const tenantId = input.authContext.tenantId!;

  await db.transaction(async (tx) => {
    const existing = await findHardwareConfigById(tx, tenantId, input.hardwareId);

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    await softDeleteHardwareConfig(tx, {
      hardwareId: input.hardwareId,
      tenantId,
      version: input.version,
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.deleted",
      entityType: "hardware_config",
      entityId: input.hardwareId,
      before: {
        name: existing.name,
        deviceType: existing.deviceType,
        connectionType: existing.connectionType,
        branchId: existing.branchId,
        status: existing.status,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
