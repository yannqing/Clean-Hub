import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertPosContext,
  requirePosBranchId,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { findEnabledTenantPaymentProviders } from "../../tenant/payment-integrations/payment-integrations.repository.js";
import { requirePosTerminalContext } from "../access-control.helper.js";
import { findOpenRegisterSession } from "../staff/staff.repository.js";
import { PosTerminalSettingsError } from "./terminal-settings.errors.js";
import {
  findAuthenticatedTerminalSettings,
  findTerminalSettingsByTenantAndDevice,
  findBranchPaymentPolicy,
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

async function withTenantFinancialDefaults(
  db: Database,
  settings: PosTerminalSettingsSummary,
): Promise<PosTerminalSettingsSummary> {
  const [defaults, mobileMoneyProvidersEnabled, branchPolicy] =
    await Promise.all([
      findTenantPosTerminalDefaults(db, settings.tenantId),
      findEnabledTenantPaymentProviders(db, settings.tenantId),
      findBranchPaymentPolicy(db, {
        tenantId: settings.tenantId,
        branchId: settings.branchId,
      }),
    ]);
  const branchMethods = branchPolicy?.paymentMethodsEnabled ?? ["cash"];
  const paymentMethodsEnabled =
    mobileMoneyProvidersEnabled.length > 0
      ? [...branchMethods]
      : branchMethods.filter((method) => method !== "app");
  if (paymentMethodsEnabled.length === 0) paymentMethodsEnabled.push("cash");
  const branchDefaultMethod = branchPolicy?.defaultPaymentMethod ?? "cash";
  const defaultPaymentMethod = paymentMethodsEnabled.includes(
    branchDefaultMethod,
  )
    ? branchDefaultMethod
    : paymentMethodsEnabled[0]!;
  return {
    ...settings,
    defaultPaymentMethod,
    paymentMethodsEnabled,
    cashHandlingMode: !paymentMethodsEnabled.includes("cash")
      ? "none"
      : !defaults.cashTrackingEnabled
        ? "untracked"
        : (branchPolicy?.cashHandlingMode ?? "shared_drawer"),
    cashTrackingEnabled: defaults.cashTrackingEnabled,
    requireOpeningFloat: defaults.requireOpeningFloat,
    requireClosingCount: defaults.requireClosingCount,
    mobileMoneyProvidersEnabled,
    taxEnabled: defaults.taxEnabled,
    defaultTaxRate: defaults.defaultTaxRate,
    pricesIncludeTax: defaults.pricesIncludeTax,
    taxRegistrationNumber: defaults.taxRegistrationNumber,
  };
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

  return withTenantFinancialDefaults(db, settings);
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

    return withTenantFinancialDefaults(tx, settings);
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

  return withTenantFinancialDefaults(db, settings);
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

  const changesCashPolicy =
    (data.cashHandlingMode !== undefined &&
      data.cashHandlingMode !== current.cashHandlingMode) ||
    (data.paymentMethodsEnabled !== undefined &&
      data.paymentMethodsEnabled.includes("cash") !==
        current.paymentMethodsEnabled.includes("cash"));
  if (
    changesCashPolicy &&
    (await findOpenRegisterSession(db, {
      tenantId: terminal.tenantId,
      terminalId: terminal.terminalId,
    }))
  ) {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "Close the current register before changing its cash handling policy.",
      409,
    );
  }

  const nextEnabledMethods =
    data.paymentMethodsEnabled ?? current.paymentMethodsEnabled;
  const nextDefaultMethod =
    data.defaultPaymentMethod ?? current.defaultPaymentMethod;
  if (!nextEnabledMethods.includes(nextDefaultMethod)) {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "The default payment method must also be enabled for this terminal.",
      422,
    );
  }
  const nextCashHandlingMode =
    data.cashHandlingMode !== undefined
      ? data.cashHandlingMode
      : current.cashHandlingMode;
  if (
    (nextEnabledMethods.includes("cash") && nextCashHandlingMode === "none") ||
    (!nextEnabledMethods.includes("cash") && nextCashHandlingMode !== "none")
  ) {
    throw new PosTerminalSettingsError(
      "VALIDATION_ERROR",
      "Cash handling must be disabled exactly when cash payments are disabled.",
      422,
    );
  }
  if (
    (data.paymentMethodsEnabled?.includes("app") ||
      data.defaultPaymentMethod === "app") &&
    (await findEnabledTenantPaymentProviders(db, terminal.tenantId)).length ===
      0
  ) {
    throw new PosTerminalSettingsError(
      "MOBILE_MONEY_INTEGRATION_REQUIRED",
      "Configure, verify, and enable Wave or Orange Money before enabling mobile payment on this terminal.",
      422,
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

    return withTenantFinancialDefaults(tx, updated);
  });
}
