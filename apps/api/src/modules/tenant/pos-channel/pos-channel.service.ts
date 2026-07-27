import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import { resolveAllowedBranchIds } from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { TenantPosChannelError } from "./pos-channel.errors.js";
import {
  findPosChannelContext,
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
  PosChannelOverview,
  PosChannelOverviewQuery,
  PosChannelRegisterSessionList,
  PosChannelRegisterSessionQuery,
  PosChannelRequestInput,
  PosChannelSettings,
  UpdatePosChannelSettingsRequest,
} from "./pos-channel.types.js";

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
  const { context } = await resolvePosChannelAccess(authContext, db);

  return {
    ...context.settings,
    canManage: authContext.role === "owner",
  };
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
    const nextRelationship = {
      syncIntervalSeconds:
        input.data.syncIntervalSeconds ?? current.syncIntervalSeconds,
      deviceOfflineAfterSeconds:
        input.data.deviceOfflineAfterSeconds ??
        current.deviceOfflineAfterSeconds,
    };
    validateSettingsRelationship(nextRelationship);

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

    return {
      ...updated,
      canManage: true,
    };
  });
}
