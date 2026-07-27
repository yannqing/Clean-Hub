import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requirePosBranchId,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { PosTerminalSettingsError } from "./terminal-settings.errors.js";
import {
  findTerminalSettingsByTenantAndDevice,
  findTenantPosTerminalDefaults,
  insertTerminalSettings,
  updateTerminalHeartbeat,
  updateTerminalLastSeen,
  updateTerminalSettingsRecord,
} from "./terminal-settings.repository.js";
import type {
  CreatePosTerminalSettingsRequest,
  PosTerminalHeartbeatRequest,
  PosTerminalSettingsSummary,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types.js";

function requirePosTenantId(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

// ---------------------------------------------------------------------------
// GET /pos/terminal-settings?deviceId=...
// ---------------------------------------------------------------------------

export async function getPosTerminalSettings(
  authContext: AuthContext,
  deviceId: string,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const tenantId = requirePosTenantId(authContext);

  const settings = await findTerminalSettingsByTenantAndDevice(
    db,
    tenantId,
    deviceId,
  );

  if (!settings) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Terminal settings not found for this device.",
      404,
    );
  }

  // Verify branch access for non-owner roles.
  await requirePosBranchId(authContext, settings.branchId, db);

  // Update lastSeenAt on every read (fire-and-forget).
  void updateTerminalLastSeen(db, tenantId, deviceId).catch(() => {
    /* ignore */
  });

  return settings;
}

// ---------------------------------------------------------------------------
// POST /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function createPosTerminalSettings(
  authContext: AuthContext,
  data: CreatePosTerminalSettingsRequest,
  requestMeta?: AuthRequestMeta,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const tenantId = requirePosTenantId(authContext);

  // Only owner/manager can create terminal settings.
  if (authContext.role === "cashier") {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "Cashiers cannot create terminal settings.",
      403,
    );
  }

  // Verify branch access.
  await requirePosBranchId(authContext, data.branchId, db);

  return db.transaction(async (tx) => {
    // Check for duplicate deviceId inside the transaction to avoid race conditions.
    const existing = await findTerminalSettingsByTenantAndDevice(
      tx,
      tenantId,
      data.deviceId,
    );

    if (existing) {
      throw new PosTerminalSettingsError(
        "TERMINAL_SETTINGS_ALREADY_EXISTS",
        "Terminal settings already exist for this device. Use PATCH to update.",
        409,
      );
    }

    const defaults = await findTenantPosTerminalDefaults(tx, tenantId);
    const settings = await insertTerminalSettings(
      tx,
      tenantId,
      authContext.userId,
      {
        ...data,
        defaultPaymentMethod:
          data.defaultPaymentMethod ?? defaults.defaultPaymentMethod,
        roundingRule: data.roundingRule ?? defaults.roundingRule,
        autoPrintReceipt: data.autoPrintReceipt ?? defaults.autoPrintReceipt,
        printCopies: data.printCopies ?? defaults.printCopies,
        lockTimeoutSeconds:
          data.lockTimeoutSeconds ?? defaults.lockTimeoutSeconds,
      },
    );

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: data.branchId,
      eventCategory: "pos_terminal_settings",
      eventType: "pos_terminal_settings.created",
      entityType: "pos_terminal_settings",
      entityId: settings.id,
      after: settings,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return settings;
  });
}

export async function heartbeatPosTerminal(
  authContext: AuthContext,
  data: PosTerminalHeartbeatRequest,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const tenantId = requirePosTenantId(authContext);
  const terminalId = authContext.terminalId;

  if (!terminalId) {
    throw new PosTerminalSettingsError(
      "POS_TERMINAL_REQUIRED",
      "An enrolled POS terminal is required.",
      403,
    );
  }

  const terminal = await updateTerminalHeartbeat(db, {
    tenantId,
    terminalId,
    data,
  });

  if (!terminal) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Active terminal settings were not found.",
      404,
    );
  }

  return terminal;
}

// ---------------------------------------------------------------------------
// PATCH /pos/terminal-settings?deviceId=...
// ---------------------------------------------------------------------------

export async function updatePosTerminalSettings(
  authContext: AuthContext,
  deviceId: string,
  data: UpdatePosTerminalSettingsRequest,
  requestMeta?: AuthRequestMeta,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const tenantId = requirePosTenantId(authContext);

  // Only owner/manager can update terminal settings.
  if (authContext.role === "cashier") {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "Cashiers cannot update terminal settings.",
      403,
    );
  }

  const current = await findTerminalSettingsByTenantAndDevice(
    db,
    tenantId,
    deviceId,
  );

  if (!current) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Terminal settings not found for this device.",
      404,
    );
  }

  // Verify branch access.
  await requirePosBranchId(authContext, current.branchId, db);

  return db.transaction(async (tx) => {
    const before = { ...current };

    const updated = await updateTerminalSettingsRecord(
      tx,
      tenantId,
      current.id,
      authContext.userId,
      data,
      current.version,
    );

    if (!updated) {
      throw new PosTerminalSettingsError(
        "VERSION_CONFLICT",
        "Terminal settings were modified by another request. Please refresh and try again.",
        409,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: current.branchId,
      eventCategory: "pos_terminal_settings",
      eventType: "pos_terminal_settings.updated",
      entityType: "pos_terminal_settings",
      entityId: current.id,
      before,
      after: updated,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    return updated;
  });
}
