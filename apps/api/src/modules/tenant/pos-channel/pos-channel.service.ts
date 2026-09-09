import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import {
  lockActiveTenantBranch,
  revokePosDeviceRecord,
  revokePosTerminalRefreshTokens,
  toPosDevice,
  updatePosDeviceRecord,
} from "../../pos/auth/auth.repository.js";
import { findOpenRegisterSession } from "../../pos/staff/staff.repository.js";
import { findEnabledTenantPaymentProviders } from "../payment-integrations/payment-integrations.repository.js";
import { TenantPosChannelError } from "./pos-channel.errors.js";
import {
  findPosChannelContext,
  findPosChannelDeviceRecordForUpdate,
  findPosChannelDevices,
  findPosChannelOverviewMetrics,
  findPosChannelRegisterSessions,
  findPosChannelSettingsRecord,
  findPosChannelStaffSummary,
  updatePosChannelSettingsRecord,
} from "./pos-channel.repository.js";
import type {
  PosChannelDeviceList,
  PosChannelDeviceListQuery,
  PosChannelDeviceMutationResult,
  PosChannelOverview,
  PosChannelOverviewQuery,
  PosChannelRegisterSessionList,
  PosChannelRegisterSessionQuery,
  PosChannelRequestInput,
  PosChannelSettings,
  RemovePosChannelDeviceRequest,
  UpdatePosChannelDeviceRequest,
  UpdatePosChannelSettingsRequest,
} from "./pos-channel.types.js";
import type { TenantPaymentProvider } from "../payment-integrations/payment-integrations.types.js";

function withPaymentIntegrationAvailability(
  settings: Omit<PosChannelSettings, "mobileMoneyProvidersEnabled">,
  providers: TenantPaymentProvider[],
): PosChannelSettings {
  const enabledMethods =
    providers.length > 0
      ? settings.defaultPaymentMethodsEnabled
      : settings.defaultPaymentMethodsEnabled.filter(
          (method) => method !== "app",
        );
  if (enabledMethods.length === 0) enabledMethods.push("cash");

  return {
    ...settings,
    defaultPaymentMethod: enabledMethods.includes(settings.defaultPaymentMethod)
      ? settings.defaultPaymentMethod
      : enabledMethods[0]!,
    defaultPaymentMethodsEnabled: enabledMethods,
    mobileMoneyProvidersEnabled: providers,
  };
}

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);
  return authContext.tenantId!;
}

function resolveTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function getDateOnlyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(
  input: { from?: string; to?: string },
  timezone: string,
): { from: string; to: string } {
  const today = getDateOnlyInTimezone(new Date(), timezone);

  return {
    from: input.from ?? addCalendarDays(input.to ?? today, -29),
    to: input.to ?? today,
  };
}

async function resolvePosChannelAccess(authContext: AuthContext, db: Database) {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  const allowedScope = await resolveAllowedBranchIds(authContext, db);
  const context = await findPosChannelContext(db, {
    tenantId,
    allowedBranchIds: allowedScope === "all" ? undefined : allowedScope,
  });

  return {
    tenantId,
    context: {
      ...context,
      timezone: resolveTimezone(context.timezone),
    },
  };
}

function resolveBranchIds(
  branchId: string | undefined,
  availableBranches: Array<{ id: string }>,
): string[] {
  if (branchId && !availableBranches.some((branch) => branch.id === branchId)) {
    throw new TenantPosChannelError(
      "POS_CHANNEL_BRANCH_NOT_FOUND",
      "Branch was not found.",
      404,
    );
  }

  return branchId ? [branchId] : availableBranches.map((branch) => branch.id);
}

function resolveCurrency(
  requestedCurrency: string | undefined,
  context: {
    defaultCurrency: string;
    availableCurrencies: string[];
  },
): string {
  if (
    requestedCurrency &&
    context.availableCurrencies.includes(requestedCurrency)
  ) {
    return requestedCurrency;
  }

  return context.availableCurrencies.includes(context.defaultCurrency)
    ? context.defaultCurrency
    : (context.availableCurrencies[0] ?? context.defaultCurrency);
}

function validateSettingsRelationship(input: {
  syncIntervalSeconds: number;
  deviceOfflineAfterSeconds: number;
}): void {
  if (input.deviceOfflineAfterSeconds < input.syncIntervalSeconds * 2) {
    throw new TenantPosChannelError(
      "POS_CHANNEL_SETTINGS_INVALID",
      "deviceOfflineAfterSeconds must be at least twice syncIntervalSeconds.",
      422,
    );
  }
}

export async function getTenantPosChannelOverview(
  authContext: AuthContext,
  input: PosChannelOverviewQuery,
  db: Database = getDb(),
): Promise<PosChannelOverview> {
  const { tenantId, context } = await resolvePosChannelAccess(authContext, db);
  const range = resolveDateRange(input, context.timezone);
  const branchIds = resolveBranchIds(input.branchId, context.availableBranches);
  const currency = resolveCurrency(input.currency, context);
  const generatedAt = new Date();
  const [overview, recentSessions, attentionDevices, staffSummary] =
    await Promise.all([
      findPosChannelOverviewMetrics(db, {
        tenantId,
        branchIds,
        ...range,
        timezone: context.timezone,
        currency,
        availableBranches: context.availableBranches,
        generatedAt,
        deviceOfflineAfterSeconds: context.settings.deviceOfflineAfterSeconds,
      }),
      findPosChannelRegisterSessions(db, {
        tenantId,
        branchIds,
        ...range,
        timezone: context.timezone,
        query: {
          ...range,
          branchId: input.branchId,
          limit: 5,
          offset: 0,
        },
      }),
      findPosChannelDevices(db, {
        tenantId,
        branchIds,
        generatedAt,
        deviceOfflineAfterSeconds: context.settings.deviceOfflineAfterSeconds,
        attentionOnly: true,
        query: {
          branchId: input.branchId,
          limit: 5,
          offset: 0,
        },
      }),
      findPosChannelStaffSummary(db, {
        tenantId,
        branchIds,
      }),
    ]);

  return {
    generatedAt: generatedAt.toISOString(),
    timezone: context.timezone,
    currency,
    filters: {
      ...range,
      branchId: input.branchId ?? null,
    },
    metrics: overview.metrics,
    branches: overview.branches,
    recentSessions: recentSessions.data,
    attentionDevices: attentionDevices.data,
    availableBranches: context.availableBranches,
    availableCurrencies: context.availableCurrencies,
    deviceSummary: overview.deviceSummary,
    cashTracking: overview.cashTracking,
    staffSummary,
  };
}

export async function listTenantPosChannelDevices(
  authContext: AuthContext,
  query: PosChannelDeviceListQuery,
  db: Database = getDb(),
): Promise<PosChannelDeviceList> {
  const { tenantId, context } = await resolvePosChannelAccess(authContext, db);
  const branchIds = resolveBranchIds(query.branchId, context.availableBranches);
  const generatedAt = new Date();
  const result = await findPosChannelDevices(db, {
    tenantId,
    branchIds,
    query,
    generatedAt,
    deviceOfflineAfterSeconds: context.settings.deviceOfflineAfterSeconds,
  });

  return {
    ...result,
    limit: query.limit,
    offset: query.offset,
    availableBranches: context.availableBranches,
    generatedAt: generatedAt.toISOString(),
    deviceOfflineAfterSeconds: context.settings.deviceOfflineAfterSeconds,
  };
}

function deviceVersionConflict(): TenantPosChannelError {
  return new TenantPosChannelError(
    "POS_CHANNEL_DEVICE_VERSION_CONFLICT",
    "The POS terminal changed during this request. Refresh and try again.",
    409,
  );
}

export async function updateTenantPosChannelDevice(
  input: PosChannelRequestInput<UpdatePosChannelDeviceRequest> & {
    terminalId: string;
  },
  db: Database = getDb(),
): Promise<PosChannelDeviceMutationResult> {
  const { tenantId, context } = await resolvePosChannelAccess(
    input.authContext,
    db,
  );
  const branchIds = context.availableBranches.map((branch) => branch.id);

  if (
    input.data.branchId &&
    !context.availableBranches.some(
      (branch) =>
        branch.id === input.data.branchId && branch.status === "active",
    )
  ) {
    throw new TenantPosChannelError(
      "POS_CHANNEL_DEVICE_BRANCH_INACTIVE",
      "The target branch does not exist, is inactive, or is outside your access scope.",
      409,
    );
  }

  return db.transaction(async (tx) => {
    const current = await findPosChannelDeviceRecordForUpdate(tx, {
      tenantId,
      terminalId: input.terminalId,
      branchIds,
    });
    if (!current) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_DEVICE_NOT_FOUND",
        "The POS terminal was not found.",
        404,
      );
    }
    if (current.version !== input.data.version) {
      throw deviceVersionConflict();
    }

    const branchChanged =
      input.data.branchId !== undefined &&
      input.data.branchId !== current.branchId;
    const statusChanged =
      input.data.status !== undefined && input.data.status !== current.status;
    const securityContextChanged = branchChanged || statusChanged;
    const cashHandlingChanged =
      input.data.cashHandlingMode !== undefined &&
      input.data.cashHandlingMode !== current.cashHandlingMode;

    if (
      input.data.status === "active" &&
      current.status !== "active" &&
      !current.credentialDigest
    ) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_DEVICE_CREDENTIAL_REVOKED",
        "This terminal was securely removed and must be enrolled again before it can be enabled.",
        409,
      );
    }

    if (
      branchChanged ||
      cashHandlingChanged ||
      input.data.status === "inactive"
    ) {
      const registerSession = await findOpenRegisterSession(tx, {
        tenantId,
        terminalId: current.id,
        forUpdate: true,
      });
      if (registerSession) {
        throw new TenantPosChannelError(
          "POS_CHANNEL_DEVICE_REGISTER_OPEN",
          "Close the terminal's register session before changing its branch, cash handling mode, or status.",
          409,
        );
      }
    }

    if (
      (branchChanged || input.data.status === "active") &&
      !(await lockActiveTenantBranch(
        tx,
        tenantId,
        input.data.branchId ?? current.branchId,
      ))
    ) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_DEVICE_BRANCH_INACTIVE",
        "The target branch does not exist or is inactive.",
        409,
      );
    }

    const saved = await updatePosDeviceRecord(tx, current, {
      actorUserId: input.authContext.userId,
      data: {
        ...(input.data.branchId ? { branchId: input.data.branchId } : {}),
        ...(input.data.cashHandlingMode
          ? { cashHandlingMode: input.data.cashHandlingMode }
          : {}),
        ...(input.data.label ? { label: input.data.label } : {}),
        ...(input.data.status ? { status: input.data.status } : {}),
        reason: input.data.reason,
      },
    });
    if (!saved) throw deviceVersionConflict();

    if (securityContextChanged) {
      await revokePosTerminalRefreshTokens(tx, tenantId, saved.id);
    }

    const before = toPosDevice(current);
    const after = toPosDevice(saved);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: after.branchId,
      eventCategory: "pos_terminal_security",
      eventType:
        statusChanged && saved.status === "inactive"
          ? "pos_terminal.disabled"
          : statusChanged && saved.status === "active"
            ? "pos_terminal.enabled"
            : branchChanged
              ? "pos_terminal.rebound"
              : "pos_terminal.updated",
      entityType: "pos_terminal_settings",
      entityId: saved.id,
      reason: input.data.reason,
      before: { ...before },
      after: { ...after },
      metadata: {
        terminalId: saved.id,
        terminalDeviceId: saved.deviceId,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return { id: saved.id, version: saved.version };
  });
}

export async function removeTenantPosChannelDevice(
  input: PosChannelRequestInput<RemovePosChannelDeviceRequest> & {
    terminalId: string;
  },
  db: Database = getDb(),
): Promise<void> {
  const { tenantId, context } = await resolvePosChannelAccess(
    input.authContext,
    db,
  );
  const branchIds = context.availableBranches.map((branch) => branch.id);

  await db.transaction(async (tx) => {
    const current = await findPosChannelDeviceRecordForUpdate(tx, {
      tenantId,
      terminalId: input.terminalId,
      branchIds,
    });
    if (!current) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_DEVICE_NOT_FOUND",
        "The POS terminal was not found.",
        404,
      );
    }
    if (current.version !== input.data.version) {
      throw deviceVersionConflict();
    }

    const registerSession = await findOpenRegisterSession(tx, {
      tenantId,
      terminalId: current.id,
      forUpdate: true,
    });
    if (registerSession) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_DEVICE_REGISTER_OPEN",
        "Close the terminal's register session before removing the terminal.",
        409,
      );
    }

    const saved = await revokePosDeviceRecord(tx, current, {
      actorUserId: input.authContext.userId,
      reason: input.data.reason,
    });
    if (!saved) throw deviceVersionConflict();

    await revokePosTerminalRefreshTokens(tx, tenantId, saved.id);
    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branchId: current.branchId,
      eventCategory: "pos_terminal_security",
      eventType: "pos_terminal.revoked",
      entityType: "pos_terminal_settings",
      entityId: saved.id,
      reason: input.data.reason,
      before: { ...toPosDevice(current) },
      after: { ...toPosDevice(saved) },
      metadata: {
        terminalId: saved.id,
        terminalDeviceId: saved.deviceId,
        credentialVersion: saved.credentialVersion,
        removedFromTenantAdmin: true,
      },
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });
  });
}

export async function listTenantPosChannelRegisterSessions(
  authContext: AuthContext,
  query: PosChannelRegisterSessionQuery,
  db: Database = getDb(),
): Promise<PosChannelRegisterSessionList> {
  const { tenantId, context } = await resolvePosChannelAccess(authContext, db);
  const branchIds = resolveBranchIds(query.branchId, context.availableBranches);
  const range = resolveDateRange(query, context.timezone);
  const generatedAt = new Date();
  const result = await findPosChannelRegisterSessions(db, {
    tenantId,
    branchIds,
    ...range,
    timezone: context.timezone,
    query: {
      ...query,
      ...range,
    },
  });
  const currency =
    result.currencies.length > 1
      ? null
      : (result.currencies[0] ?? context.defaultCurrency);

  return {
    data: result.data,
    total: result.total,
    limit: query.limit,
    offset: query.offset,
    metrics: result.metrics,
    currency,
    timezone: context.timezone,
    availableCurrencies: context.availableCurrencies,
    availableBranches: context.availableBranches,
    filters: {
      ...range,
      branchId: query.branchId ?? null,
      status: query.status ?? null,
      q: query.q ?? null,
    },
    generatedAt: generatedAt.toISOString(),
  };
}

export async function getTenantPosChannelSettings(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<PosChannelSettings> {
  const { tenantId, context } = await resolvePosChannelAccess(authContext, db);
  const providers = await findEnabledTenantPaymentProviders(db, tenantId);

  return withPaymentIntegrationAvailability(
    {
      ...context.settings,
      canManage: authContext.role === "owner",
    },
    providers,
  );
}

export async function updateTenantPosChannelSettings(
  input: PosChannelRequestInput<UpdatePosChannelSettingsRequest>,
  db: Database = getDb(),
): Promise<PosChannelSettings> {
  const tenantId = getTenantId(input.authContext);

  requireTenantRole(input.authContext, ["owner"]);
  await assertActiveTenant(input.authContext, db);

  return db.transaction(async (tx) => {
    const current = await findPosChannelSettingsRecord(tx, tenantId);
    const mobileMoneyProvidersEnabled = await findEnabledTenantPaymentProviders(
      tx,
      tenantId,
    );
    const nextRelationship = {
      syncIntervalSeconds:
        input.data.syncIntervalSeconds ?? current.syncIntervalSeconds,
      deviceOfflineAfterSeconds:
        input.data.deviceOfflineAfterSeconds ??
        current.deviceOfflineAfterSeconds,
    };
    validateSettingsRelationship(nextRelationship);
    const enabledMethods =
      input.data.defaultPaymentMethodsEnabled ??
      current.defaultPaymentMethodsEnabled;
    const defaultMethod =
      input.data.defaultPaymentMethod ?? current.defaultPaymentMethod;
    if (!enabledMethods.includes(defaultMethod)) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_SETTINGS_INVALID",
        "The default payment method must also be enabled.",
        422,
      );
    }
    if (
      (input.data.defaultPaymentMethodsEnabled?.includes("app") ||
        input.data.defaultPaymentMethod === "app") &&
      mobileMoneyProvidersEnabled.length === 0
    ) {
      throw new TenantPosChannelError(
        "MOBILE_MONEY_INTEGRATION_REQUIRED",
        "Configure, verify, and enable Wave or Orange Money before enabling mobile payment defaults.",
        422,
      );
    }

    const updated = await updatePosChannelSettingsRecord(tx, {
      tenantId,
      actorUserId: input.authContext.userId,
      data: input.data,
      current,
    });

    if (!updated) {
      throw new TenantPosChannelError(
        "POS_CHANNEL_SETTINGS_CONFLICT",
        "POS channel settings were modified by another request. Please refresh and try again.",
        409,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      eventCategory: "pos_channel_settings",
      eventType: "pos_channel_settings.updated",
      entityType: "pos_channel_settings",
      entityId: updated.id ?? tenantId,
      before: current,
      after: updated,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return withPaymentIntegrationAvailability(
      { ...updated, canManage: true },
      mobileMoneyProvidersEnabled,
    );
  });
}
