import { getDb, type Database } from "@cleanhub/db";

import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  assertBranchIdsSubset,
  resolveAllowedBranchIds,
} from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { HardwareError } from "./hardware.errors.js";
import {
  findHardwareConfigById,
  findHardwareConfigs,
  findHardwareTerminal,
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

type HardwareAccess = {
  tenantId: string;
  allowedBranchIds?: string[];
};

function normalizeHardwareConfig(
  deviceType: HardwareConfigSummary["deviceType"],
  config: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const normalized = { ...(config ?? {}) };
  if (
    deviceType === "printer" &&
    normalized.printerPurpose !== "receipt" &&
    normalized.printerPurpose !== "label"
  ) {
    normalized.printerPurpose = "receipt";
  }
  return normalized;
}

async function resolveHardwareAccess(
  authContext: ListHardwareConfigsInput["authContext"],
  db: Database,
): Promise<HardwareAccess> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const scope = await resolveAllowedBranchIds(authContext, db);

  return {
    tenantId: authContext.tenantId!,
    allowedBranchIds: scope === "all" ? undefined : scope,
  };
}

export async function listHardwareConfigs(
  input: ListHardwareConfigsInput,
  db: Database = getDb(),
): Promise<HardwareConfigSummary[]> {
  const access = await resolveHardwareAccess(input.authContext, db);

  return findHardwareConfigs(
    db,
    access.tenantId,
    input.query,
    access.allowedBranchIds,
  );
}

export async function createHardwareConfig(
  input: CreateHardwareConfigInput,
  db: Database = getDb(),
): Promise<HardwareConfigSummary> {
  const access = await resolveHardwareAccess(input.authContext, db);
  const tenantId = access.tenantId;

  return db.transaction(async (tx) => {
    const terminal = await findHardwareTerminal(
      tx,
      tenantId,
      input.data.terminalId,
    );
    if (!terminal) {
      throw new HardwareError(
        "HARDWARE_TERMINAL_NOT_FOUND",
        "POS terminal was not found.",
        404,
      );
    }
    await assertBranchIdsSubset(input.authContext, [terminal.branchId], tx);

    const hardware = await insertHardwareConfig(tx, {
      tenantId,
      terminalId: terminal.id,
      name: input.data.name,
      deviceType: input.data.deviceType,
      connectionType: input.data.connectionType,
      config: normalizeHardwareConfig(input.data.deviceType, input.data.config),
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: terminal.branchId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.created",
      entityType: "hardware_config",
      entityId: hardware.id,
      after: {
        name: hardware.name,
        deviceType: hardware.deviceType,
        connectionType: hardware.connectionType,
        terminalId: hardware.terminalId,
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
  const access = await resolveHardwareAccess(input.authContext, db);
  const tenantId = access.tenantId;

  return db.transaction(async (tx) => {
    const existing = await findHardwareConfigById(
      tx,
      tenantId,
      input.hardwareId,
      access.allowedBranchIds,
    );

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    if (existing.provisioningMode === "built_in") {
      throw new HardwareError(
        "HARDWARE_BUILT_IN_READ_ONLY",
        "Built-in hardware is managed by its POS terminal and cannot be edited in tenant administration.",
        409,
      );
    }

    let targetBranchId = existing.branchId;

    if (input.data.terminalId) {
      const terminal = await findHardwareTerminal(
        tx,
        tenantId,
        input.data.terminalId,
      );
      if (!terminal) {
        throw new HardwareError(
          "HARDWARE_TERMINAL_NOT_FOUND",
          "POS terminal was not found.",
          404,
        );
      }
      await assertBranchIdsSubset(input.authContext, [terminal.branchId], tx);
      targetBranchId = terminal.branchId;
    }

    await updateHardwareConfigRecord(tx, {
      hardwareId: input.hardwareId,
      tenantId,
      name: input.data.name,
      terminalId: input.data.terminalId,
      connectionType: input.data.connectionType,
      config:
        input.data.config === undefined
          ? undefined
          : normalizeHardwareConfig(existing.deviceType, input.data.config),
      status: input.data.status,
      version: input.data.version,
      actorUserId: input.authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: targetBranchId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.updated",
      entityType: "hardware_config",
      entityId: input.hardwareId,
      before: {
        name: existing.name,
        terminalId: existing.terminalId,
        branchId: existing.branchId,
        connectionType: existing.connectionType,
        config: existing.config,
        status: existing.status,
      },
      after: input.data,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    const updated = await findHardwareConfigById(
      tx,
      tenantId,
      input.hardwareId,
      access.allowedBranchIds,
    );

    return updated!;
  });
}

export async function deleteHardwareConfig(
  input: DeleteHardwareConfigInput,
  db: Database = getDb(),
): Promise<void> {
  const access = await resolveHardwareAccess(input.authContext, db);
  const tenantId = access.tenantId;

  await db.transaction(async (tx) => {
    const existing = await findHardwareConfigById(
      tx,
      tenantId,
      input.hardwareId,
      access.allowedBranchIds,
    );

    if (!existing) {
      throw new HardwareError(
        "HARDWARE_NOT_FOUND",
        "Hardware config was not found.",
        404,
      );
    }

    if (existing.provisioningMode === "built_in") {
      throw new HardwareError(
        "HARDWARE_BUILT_IN_READ_ONLY",
        "Built-in hardware is managed by its POS terminal and cannot be deleted.",
        409,
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
      branchId: existing.branchId,
      eventCategory: "tenant_hardware",
      eventType: "tenant_hardware.deleted",
      entityType: "hardware_config",
      entityId: input.hardwareId,
      before: {
        name: existing.name,
        deviceType: existing.deviceType,
        connectionType: existing.connectionType,
        terminalId: existing.terminalId,
        branchId: existing.branchId,
        status: existing.status,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}
