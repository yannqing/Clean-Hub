import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requirePosBranchId,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { requirePosTerminalContext } from "../access-control.helper.js";
import { PosTerminalSettingsError } from "./terminal-settings.errors.js";
import {
  findAuthenticatedTerminalSettings,
  findTerminalSettingsByTenantAndDevice,
  findTenantPosTerminalDefaults,
  insertTerminalSettings,
  updateAuthenticatedTerminalLastSeen,
  updateTerminalHeartbeat,
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
// GET /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function getPosTerminalSettings(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const terminal = requirePosTerminalContext(authContext);
  const settings = await findAuthenticatedTerminalSettings(db, terminal);

  if (!settings) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Active settings were not found for the authenticated terminal.",
      404,
    );
  }

  // Update lastSeenAt on every read (fire-and-forget).
  void updateAuthenticatedTerminalLastSeen(db, terminal).catch(() => {
    /* ignore */
  });

  return settings;
}

// ---------------------------------------------------------------------------
// Internal provisioning helper. Public terminal enrollment must use
// POST /pos/auth/devices so a credential is issued atomically.
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
  const terminal = requirePosTerminalContext(authContext);

  const settings = await updateTerminalHeartbeat(db, {
    terminal,
    data,
  });

  if (!settings) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Active settings were not found for the authenticated terminal.",
      404,
    );
  }

  return settings;
}

// ---------------------------------------------------------------------------
// PATCH /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function updatePosTerminalSettings(
  authContext: AuthContext,
  data: UpdatePosTerminalSettingsRequest,
  requestMeta?: AuthRequestMeta,
  db: Database = getDb(),
): Promise<PosTerminalSettingsSummary> {
  const terminal = requirePosTerminalContext(authContext);

  // Only owner/manager can update terminal settings.
  if (authContext.role === "cashier") {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "Cashiers cannot update terminal settings.",
      403,
    );
  }

  const current = await findAuthenticatedTerminalSettings(db, terminal);

  if (!current) {
    throw new PosTerminalSettingsError(
      "TERMINAL_SETTINGS_NOT_FOUND",
      "Active settings were not found for the authenticated terminal.",
      404,
    );
  }

  return db.transaction(async (tx) => {
    const before = { ...current };

    const updated = await updateTerminalSettingsRecord(
      tx,
      terminal,
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
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
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
