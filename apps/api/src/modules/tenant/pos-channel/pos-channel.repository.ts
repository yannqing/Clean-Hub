import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  orderDiscountAllocations,
  orderDiscountApplications,
  orderItems,
  orders,
  posChannelSettings,
  posPaymentAdjustments,
  posStaffShifts,
  posTerminalSettings,
  posZReports,
  roles,
  refundRequests,
  salesReturns,
  tenantSettings,
  userBranches,
  userProfiles,
  userRoles,
  users,
  type Database,
} from "@cleanhub/db";
import {
  derivePosTerminalOperationalStatus,
  type PosTerminalConnectionState,
  type PosTerminalRuntimeSyncState,
  type PosTerminalServiceHealth,
} from "@cleanhub/domain/pos-terminal-status";
import { createId } from "@cleanhub/id";

import type {
  PosChannelAvailableBranch,
  PosChannelBranchPerformance,
  PosChannelCashTrackingSummary,
  PosChannelDeviceListQuery,
  PosChannelDeviceMetrics,
  PosChannelDeviceSummary,
  PosChannelOverviewMetrics,
  PosChannelRegisterSession,
  PosChannelRegisterSessionMetrics,
  PosChannelRegisterSessionQuery,
  PosChannelSettings,
  PosChannelStaffSummary,
  UpdatePosChannelSettingsRequest,
} from "./pos-channel.types.js";

type PosChannelSettingsRecord = Omit<
  PosChannelSettings,
  "canManage" | "mobileMoneyProvidersEnabled"
>;

export type PosChannelContext = {
  timezone: string;
  defaultCurrency: string;
  availableCurrencies: string[];
  availableBranches: PosChannelAvailableBranch[];
  settings: PosChannelSettingsRecord;
};

type ScopedRepositoryInput = {
  tenantId: string;
  branchIds: string[];
};

type DateRangeInput = {
  from: string;
  to: string;
  timezone: string;
};

type DeviceRepositoryInput = ScopedRepositoryInput & {
  query: PosChannelDeviceListQuery;
  generatedAt: Date;
  deviceOfflineAfterSeconds: number;
  attentionOnly?: boolean;
};

type SessionRepositoryInput = ScopedRepositoryInput &
  DateRangeInput & {
    query: PosChannelRegisterSessionQuery;
  };

type OverviewRepositoryInput = ScopedRepositoryInput &
  DateRangeInput & {
    currency: string;
    availableBranches: PosChannelAvailableBranch[];
    generatedAt: Date;
    deviceOfflineAfterSeconds: number;
  };

type BranchFinancialMetrics = {
  grossSales: number;
  returns: number;
  grossProfit: number;
  costCoverageAmount: number;
  closedNetSales: number;
  cashVariance: number;
  expectedCash: number;
  countedCash: number;
  orderCount: number;
};

type BranchOperationalMetrics = {
  totalDevices: number;
  activeDevices: number;
  onlineDevices: number;
  openSessions: number;
  closedSessions: number;
};

const DEFAULT_POS_CHANNEL_SETTINGS = {
  cashTrackingEnabled: true,
  requireOpeningFloat: true,
  requireClosingCount: true,
  requireReturnReason: true,
  recentCartRetentionHours: 24,
  offlineModeEnabled: true,
  syncIntervalSeconds: 60,
  deviceOfflineAfterSeconds: 600,
  defaultPaymentMethod: "cash",
  defaultPaymentMethodsEnabled: ["cash", "app"] as Array<
    "cash" | "card" | "app"
  >,
  defaultRoundingRule: "none",
  taxEnabled: false,
  defaultTaxRate: "0.0000",
  pricesIncludeTax: true,
  taxRegistrationNumber: null,
  defaultAutoPrintReceipt: true,
  defaultPrintCopies: 1,
  defaultLockTimeoutSeconds: 300,
} as const;

const STAFF_ROLE_PRIORITY = {
  owner: 3,
  manager: 2,
  cashier: 1,
} as const;

function toNumber(value: number | string | null | undefined): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result) ? result : 0;
}

function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function toMoney(value: number | string | null | undefined): number {
  return Number(toNumber(value).toFixed(2));
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function createDefaultSettings(tenantId: string): PosChannelSettingsRecord {
  return {
    id: null,
    tenantId,
    ...DEFAULT_POS_CHANNEL_SETTINGS,
    createdAt: null,
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 0,
  };
}

function toSettingsRecord(
  row: typeof posChannelSettings.$inferSelect,
): PosChannelSettingsRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    cashTrackingEnabled: row.cashTrackingEnabled,
    requireOpeningFloat: row.requireOpeningFloat,
    requireClosingCount: row.requireClosingCount,
    requireReturnReason: row.requireReturnReason,
    recentCartRetentionHours: row.recentCartRetentionHours,
    offlineModeEnabled: row.offlineModeEnabled,
    syncIntervalSeconds: row.syncIntervalSeconds,
    deviceOfflineAfterSeconds: row.deviceOfflineAfterSeconds,
    defaultPaymentMethod: row.defaultPaymentMethod,
    defaultPaymentMethodsEnabled: row.defaultPaymentMethodsEnabled,
    defaultRoundingRule: row.defaultRoundingRule,
    taxEnabled: row.taxEnabled,
    defaultTaxRate: row.defaultTaxRate,
    pricesIncludeTax: row.pricesIncludeTax,
    taxRegistrationNumber: row.taxRegistrationNumber,
    defaultAutoPrintReceipt: row.defaultAutoPrintReceipt,
    defaultPrintCopies: row.defaultPrintCopies,
    defaultLockTimeoutSeconds: row.defaultLockTimeoutSeconds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

function applyDateRange(
  filters: SQL[],
  column:
    | typeof orders.createdAt
    | typeof refundRequests.refundedAt
    | typeof salesReturns.completedAt
    | typeof posPaymentAdjustments.occurredAt
    | typeof posStaffShifts.startedAt
    | typeof posStaffShifts.endedAt
    | typeof posZReports.cutoffAt,
  input: DateRangeInput,
): void {
  filters.push(
    sql`${column} >= (${input.from}::date::timestamp at time zone ${input.timezone})`,
    sql`${column} < ((${input.to}::date + 1)::timestamp at time zone ${input.timezone})`,
  );
}

function createConnectivityExpression(offlineAt: Date, generatedAt: Date): SQL {
  return sql`case
    when ${posTerminalSettings.lastSeenAt} is null then 'never'
    when ${posTerminalSettings.realtimeProtocolVersion} is not null
      and ${posTerminalSettings.connectionLeaseUntil} >= ${generatedAt}
      then 'online'
    when ${posTerminalSettings.realtimeProtocolVersion} is not null then 'offline'
    when ${posTerminalSettings.lastSeenAt} >= ${offlineAt} then 'online'
    else 'offline'
  end`;
}

function toRuntimeSyncState(
  status: "never" | "syncing" | "synced" | "error",
): PosTerminalRuntimeSyncState {
  if (status === "synced") return "idle";
  if (status === "syncing") return "syncing";
  return status;
}

function deriveDeviceRuntimeState(
  row: {
    status: "active" | "inactive";
    syncStatus: "never" | "syncing" | "synced" | "error";
    lastSeenAt: Date | null;
    connectionLeaseUntil: Date | null;
    pendingSalesCount: number | null;
    pendingOperationsCount: number | null;
  },
  generatedAt: Date,
  offlineAt: Date,
) {
  const leaseFresh = Boolean(
    row.connectionLeaseUntil &&
    row.connectionLeaseUntil.getTime() >= generatedAt.getTime(),
  );
  const httpFresh = Boolean(
    row.lastSeenAt && row.lastSeenAt.getTime() >= offlineAt.getTime(),
  );
  const connectionState: PosTerminalConnectionState = leaseFresh
    ? "connected"
    : "disconnected";
  const serviceHealth: PosTerminalServiceHealth = leaseFresh
    ? "healthy"
    : httpFresh
      ? "healthy"
      : "unavailable";
  const syncState = toRuntimeSyncState(row.syncStatus);
  const facts = {
    administrativeStatus: row.status,
    connectionState,
    serviceHealth,
    syncState,
    pendingSalesCount: row.pendingSalesCount,
    pendingOperationsCount: row.pendingOperationsCount,
    hasEverConnected: Boolean(row.lastSeenAt),
  } as const;

  return {
    connectionState,
    serviceHealth,
    operationalStatus: derivePosTerminalOperationalStatus(facts),
  };
}

function createDeviceScopeFilters(
  input: DeviceRepositoryInput,
  includeQueryFilters: boolean,
): SQL[] {
  if (input.branchIds.length === 0) {
    return [sql`false`];
  }

  const offlineAt = new Date(
    input.generatedAt.getTime() - input.deviceOfflineAfterSeconds * 1000,
  );
  const connectivity = createConnectivityExpression(
    offlineAt,
    input.generatedAt,
  );
  const filters: SQL[] = [
    eq(posTerminalSettings.tenantId, input.tenantId),
    inArray(posTerminalSettings.branchId, input.branchIds),
    sql`coalesce(${posTerminalSettings.metadata}->>'lastEnrollmentAction', '') <> 'revoked'`,
  ];

  if (input.attentionOnly) {
    filters.push(
      or(
        eq(posTerminalSettings.status, "inactive"),
        sql`${connectivity} <> 'online'`,
        eq(posTerminalSettings.syncStatus, "error"),
      )!,
    );
  }

  if (!includeQueryFilters) {
    return filters;
  }

  if (input.query.branchId) {
    filters.push(eq(posTerminalSettings.branchId, input.query.branchId));
  }

  if (input.query.status) {
    filters.push(eq(posTerminalSettings.status, input.query.status));
  }

  if (input.query.connectivity) {
    filters.push(sql`${connectivity} = ${input.query.connectivity}`);
  }

  if (input.query.q) {
    const pattern = `%${escapeLikePattern(input.query.q)}%`;
    filters.push(
      or(
        sql`${posTerminalSettings.deviceId} ilike ${pattern} escape '\\'`,
        sql`${posTerminalSettings.label} ilike ${pattern} escape '\\'`,
        sql`${posTerminalSettings.platform} ilike ${pattern} escape '\\'`,
        sql`${posTerminalSettings.appVersion} ilike ${pattern} escape '\\'`,
        sql`${branches.name} ilike ${pattern} escape '\\'`,
      )!,
    );
  }

  return filters;
}

function createSessionFilters(
  input: SessionRepositoryInput,
  includeQueryFilters: boolean,
): SQL[] {
  if (input.branchIds.length === 0) {
    return [sql`false`];
  }

  const filters: SQL[] = [
    eq(posStaffShifts.tenantId, input.tenantId),
    inArray(posStaffShifts.branchId, input.branchIds),
  ];
  applyDateRange(filters, posStaffShifts.startedAt, input);

  if (!includeQueryFilters) {
    return filters;
  }

  if (input.query.branchId) {
    filters.push(eq(posStaffShifts.branchId, input.query.branchId));
  }

  if (input.query.status) {
    filters.push(eq(posStaffShifts.status, input.query.status));
  }

  if (input.query.q) {
    const pattern = `%${escapeLikePattern(input.query.q)}%`;
    filters.push(
      or(
        sql`${userProfiles.displayName} ilike ${pattern} escape '\\'`,
        sql`${users.email} ilike ${pattern} escape '\\'`,
        sql`${posTerminalSettings.deviceId} ilike ${pattern} escape '\\'`,
        sql`${posTerminalSettings.label} ilike ${pattern} escape '\\'`,
        sql`${branches.name} ilike ${pattern} escape '\\'`,
      )!,
    );
  }

  return filters;
}

export async function findPosChannelSettingsRecord(
  db: Database,
  tenantId: string,
): Promise<PosChannelSettingsRecord> {
  const rows = await db
    .select()
    .from(posChannelSettings)
    .where(eq(posChannelSettings.tenantId, tenantId))
    .limit(1);

  return rows[0] ? toSettingsRecord(rows[0]) : createDefaultSettings(tenantId);
}

export async function updatePosChannelSettingsRecord(
  db: Database,
  input: {
    tenantId: string;
    actorUserId: string;
    data: UpdatePosChannelSettingsRequest;
    current: PosChannelSettingsRecord;
  },
): Promise<PosChannelSettingsRecord | null> {
  const { version: _version, ...requestedValues } = input.data;
  const values = {
    cashTrackingEnabled:
      requestedValues.cashTrackingEnabled ?? input.current.cashTrackingEnabled,
    requireOpeningFloat:
      requestedValues.requireOpeningFloat ?? input.current.requireOpeningFloat,
    requireClosingCount:
      requestedValues.requireClosingCount ?? input.current.requireClosingCount,
    requireReturnReason:
      requestedValues.requireReturnReason ?? input.current.requireReturnReason,
    recentCartRetentionHours:
      requestedValues.recentCartRetentionHours ??
      input.current.recentCartRetentionHours,
    offlineModeEnabled:
      requestedValues.offlineModeEnabled ?? input.current.offlineModeEnabled,
    syncIntervalSeconds:
      requestedValues.syncIntervalSeconds ?? input.current.syncIntervalSeconds,
    deviceOfflineAfterSeconds:
      requestedValues.deviceOfflineAfterSeconds ??
      input.current.deviceOfflineAfterSeconds,
    defaultPaymentMethod:
      requestedValues.defaultPaymentMethod ??
      input.current.defaultPaymentMethod,
    defaultPaymentMethodsEnabled:
      requestedValues.defaultPaymentMethodsEnabled ??
      input.current.defaultPaymentMethodsEnabled,
    defaultRoundingRule:
      requestedValues.defaultRoundingRule ?? input.current.defaultRoundingRule,
    taxEnabled: requestedValues.taxEnabled ?? input.current.taxEnabled,
    defaultTaxRate:
      requestedValues.defaultTaxRate ?? input.current.defaultTaxRate,
    pricesIncludeTax:
      requestedValues.pricesIncludeTax ?? input.current.pricesIncludeTax,
    taxRegistrationNumber:
      requestedValues.taxRegistrationNumber !== undefined
        ? requestedValues.taxRegistrationNumber
        : input.current.taxRegistrationNumber,
    defaultAutoPrintReceipt:
      requestedValues.defaultAutoPrintReceipt ??
      input.current.defaultAutoPrintReceipt,
    defaultPrintCopies:
      requestedValues.defaultPrintCopies ?? input.current.defaultPrintCopies,
    defaultLockTimeoutSeconds:
      requestedValues.defaultLockTimeoutSeconds ??
      input.current.defaultLockTimeoutSeconds,
  };

  if (input.current.id === null) {
    if (input.data.version !== 0) {
      return null;
    }

    const rows = await db
      .insert(posChannelSettings)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        ...values,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      })
      .onConflictDoNothing()
      .returning();

    return rows[0] ? toSettingsRecord(rows[0]) : null;
  }

  const rows = await db
    .update(posChannelSettings)
    .set({
      ...values,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${posChannelSettings.version} + 1`,
    })
    .where(
      and(
        eq(posChannelSettings.tenantId, input.tenantId),
        eq(posChannelSettings.version, input.data.version),
      ),
    )
    .returning();

  return rows[0] ? toSettingsRecord(rows[0]) : null;
}

export async function findPosChannelContext(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
  },
): Promise<PosChannelContext> {
  const branchFilters: SQL[] = [
    eq(branches.tenantId, input.tenantId),
    eq(branches.status, "active"),
    isNull(branches.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      branchFilters.push(sql`false`);
    } else {
      branchFilters.push(inArray(branches.id, input.allowedBranchIds));
    }
  }

  const [tenantSettingRows, branchRows, channelSettings] = await Promise.all([
    db
      .select({
        timezone: tenantSettings.timezone,
        defaultCurrency: tenantSettings.defaultCurrency,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, input.tenantId))
      .limit(1),
    db
      .select({
        id: branches.id,
        name: branches.name,
        status: branches.status,
        currency: branches.defaultCurrency,
      })
      .from(branches)
      .where(and(...branchFilters))
      .orderBy(asc(branches.name), asc(branches.id)),
    findPosChannelSettingsRecord(db, input.tenantId),
  ]);
  const tenantSetting = tenantSettingRows[0];
  const defaultCurrency = tenantSetting?.defaultCurrency ?? "XOF";
  const availableBranches: PosChannelAvailableBranch[] = branchRows;
  const branchIds = availableBranches.map((branch) => branch.id);
  const currencies = new Set<string>([
    defaultCurrency,
    ...availableBranches.map((branch) => branch.currency),
  ]);

  if (branchIds.length > 0) {
    const [
      orderCurrencies,
      productReturnCurrencies,
      refundCurrencies,
      adjustmentCurrencies,
      shiftCurrencies,
      zCurrencies,
    ] = await Promise.all([
      db
        .selectDistinct({ currency: orders.currency })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, input.tenantId),
            inArray(orders.branchId, branchIds),
            isNull(orders.deletedAt),
          ),
        ),
      db
        .selectDistinct({ currency: salesReturns.currency })
        .from(salesReturns)
        .where(
          and(
            eq(salesReturns.tenantId, input.tenantId),
            inArray(salesReturns.branchId, branchIds),
          ),
        ),
      db
        .selectDistinct({ currency: refundRequests.currency })
        .from(refundRequests)
        .where(
          and(
            eq(refundRequests.tenantId, input.tenantId),
            inArray(refundRequests.branchId, branchIds),
            isNull(refundRequests.deletedAt),
          ),
        ),
      db
        .selectDistinct({ currency: posPaymentAdjustments.currency })
        .from(posPaymentAdjustments)
        .where(
          and(
            eq(posPaymentAdjustments.tenantId, input.tenantId),
            inArray(posPaymentAdjustments.branchId, branchIds),
          ),
        ),
      db
        .selectDistinct({ currency: posStaffShifts.currency })
        .from(posStaffShifts)
        .where(
          and(
            eq(posStaffShifts.tenantId, input.tenantId),
            inArray(posStaffShifts.branchId, branchIds),
          ),
        ),
      db
        .selectDistinct({ currency: posZReports.currency })
        .from(posZReports)
        .where(
          and(
            eq(posZReports.tenantId, input.tenantId),
            inArray(posZReports.branchId, branchIds),
          ),
        ),
    ]);

    for (const rows of [
      orderCurrencies,
      productReturnCurrencies,
      refundCurrencies,
      adjustmentCurrencies,
      shiftCurrencies,
      zCurrencies,
    ]) {
      for (const row of rows) {
        currencies.add(row.currency);
      }
    }
  }

  return {
    timezone: tenantSetting?.timezone ?? "UTC",
    defaultCurrency,
    availableCurrencies: [...currencies].sort((left, right) => {
      if (left === defaultCurrency) return -1;
      if (right === defaultCurrency) return 1;
      return left.localeCompare(right);
    }),
    availableBranches,
    settings: channelSettings,
  };
}

export async function findPosChannelDevices(
  db: Database,
  input: DeviceRepositoryInput,
): Promise<{
  data: PosChannelDeviceSummary[];
  total: number;
  metrics: PosChannelDeviceMetrics;
}> {
  if (input.branchIds.length === 0) {
    return {
      data: [],
      total: 0,
      metrics: {
        total: 0,
        active: 0,
        inactive: 0,
        online: 0,
        offline: 0,
        never: 0,
        syncIssues: 0,
      },
    };
  }

  const offlineAt = new Date(
    input.generatedAt.getTime() - input.deviceOfflineAfterSeconds * 1000,
  );
  const connectivity = createConnectivityExpression(
    offlineAt,
    input.generatedAt,
  );
  const filtered = createDeviceScopeFilters(input, true);
  const scoped = createDeviceScopeFilters(
    { ...input, attentionOnly: false },
    false,
  );
  const [rows, countRows, metricRows] = await Promise.all([
    db
      .select({
        id: posTerminalSettings.id,
        deviceId: posTerminalSettings.deviceId,
        label: posTerminalSettings.label,
        branchId: posTerminalSettings.branchId,
        branchName: branches.name,
        status: posTerminalSettings.status,
        connectivity,
        deviceType: posTerminalSettings.deviceType,
        platform: posTerminalSettings.platform,
        platformVersion: posTerminalSettings.platformVersion,
        appVersion: posTerminalSettings.appVersion,
        syncStatus: posTerminalSettings.syncStatus,
        lastSeenAt: posTerminalSettings.lastSeenAt,
        lastRealtimeSeenAt: posTerminalSettings.lastRealtimeSeenAt,
        connectionLeaseUntil: posTerminalSettings.connectionLeaseUntil,
        lastDisconnectedAt: posTerminalSettings.lastDisconnectedAt,
        lastDisconnectReason: posTerminalSettings.lastDisconnectReason,
        pendingSalesCount: posTerminalSettings.pendingSalesCount,
        pendingOperationsCount: posTerminalSettings.pendingOperationsCount,
        oldestPendingAt: posTerminalSettings.oldestPendingAt,
        statusRevision: posTerminalSettings.statusRevision,
        realtimeProtocolVersion: posTerminalSettings.realtimeProtocolVersion,
        lastSyncedAt: posTerminalSettings.lastSyncedAt,
        lastSyncError: posTerminalSettings.lastSyncError,
        credentialVersion: posTerminalSettings.credentialVersion,
        credentialIssuedAt: posTerminalSettings.credentialIssuedAt,
        credentialRotatedAt: posTerminalSettings.credentialRotatedAt,
        credentialLastUsedAt: posTerminalSettings.credentialLastUsedAt,
        defaultPaymentMethod: posTerminalSettings.defaultPaymentMethod,
        roundingRule: posTerminalSettings.roundingRule,
        autoPrintReceipt: posTerminalSettings.autoPrintReceipt,
        printCopies: posTerminalSettings.printCopies,
        lockTimeoutSeconds: posTerminalSettings.lockTimeoutSeconds,
        currentSessionId: posStaffShifts.id,
        currentSessionStatus: posStaffShifts.status,
        currentSessionStaffId: posStaffShifts.staffId,
        currentSessionStaffName: userProfiles.displayName,
        currentSessionStartedAt: posStaffShifts.startedAt,
        createdAt: posTerminalSettings.createdAt,
        updatedAt: posTerminalSettings.updatedAt,
        version: posTerminalSettings.version,
      })
      .from(posTerminalSettings)
      .innerJoin(
        branches,
        and(
          eq(branches.id, posTerminalSettings.branchId),
          eq(branches.tenantId, posTerminalSettings.tenantId),
        ),
      )
      .leftJoin(
        posStaffShifts,
        and(
          eq(posStaffShifts.terminalId, posTerminalSettings.id),
          ne(posStaffShifts.status, "closed"),
        ),
      )
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, posStaffShifts.staffId),
          eq(userProfiles.tenantId, posStaffShifts.tenantId),
        ),
      )
      .where(and(...filtered))
      .orderBy(
        asc(posTerminalSettings.status),
        desc(posTerminalSettings.lastSeenAt),
        asc(posTerminalSettings.label),
        asc(posTerminalSettings.id),
      )
      .limit(input.query.limit)
      .offset(input.query.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posTerminalSettings)
      .innerJoin(branches, eq(branches.id, posTerminalSettings.branchId))
      .where(and(...filtered)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (
          where ${posTerminalSettings.status} = 'active'
        )::int`,
        inactive: sql<number>`count(*) filter (
          where ${posTerminalSettings.status} = 'inactive'
        )::int`,
        online: sql<number>`count(*) filter (
          where ${connectivity} = 'online'
        )::int`,
        offline: sql<number>`count(*) filter (
          where ${connectivity} = 'offline'
        )::int`,
        never: sql<number>`count(*) filter (
          where ${connectivity} = 'never'
        )::int`,
        syncIssues: sql<number>`count(*) filter (
          where ${posTerminalSettings.syncStatus} = 'error'
        )::int`,
      })
      .from(posTerminalSettings)
      .where(and(...scoped)),
  ]);
  const metrics = metricRows[0];

  return {
    data: rows.map((row) => ({
      ...deriveDeviceRuntimeState(row, input.generatedAt, offlineAt),
      id: row.id,
      deviceId: row.deviceId,
      label: row.label,
      branchId: row.branchId,
      branchName: row.branchName,
      status: row.status,
      connectivity: row.connectivity as "online" | "offline" | "never",
      deviceType: row.deviceType,
      platform: row.platform,
      platformVersion: row.platformVersion,
      appVersion: row.appVersion,
      syncStatus: row.syncStatus,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      lastRealtimeSeenAt: row.lastRealtimeSeenAt?.toISOString() ?? null,
      connectionLeaseUntil: row.connectionLeaseUntil?.toISOString() ?? null,
      lastDisconnectedAt: row.lastDisconnectedAt?.toISOString() ?? null,
      lastDisconnectReason: row.lastDisconnectReason,
      pendingSalesCount: row.pendingSalesCount,
      pendingOperationsCount: row.pendingOperationsCount,
      oldestPendingAt: row.oldestPendingAt?.toISOString() ?? null,
      statusRevision: row.statusRevision,
      realtimeProtocolVersion: row.realtimeProtocolVersion,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: row.lastSyncError,
      credentialVersion: row.credentialVersion,
      credentialIssuedAt: row.credentialIssuedAt?.toISOString() ?? null,
      credentialRotatedAt: row.credentialRotatedAt?.toISOString() ?? null,
      credentialLastUsedAt: row.credentialLastUsedAt?.toISOString() ?? null,
      defaultPaymentMethod: row.defaultPaymentMethod,
      roundingRule: row.roundingRule,
      autoPrintReceipt: row.autoPrintReceipt,
      printCopies: row.printCopies,
      lockTimeoutSeconds: row.lockTimeoutSeconds,
      currentSession:
        row.currentSessionId &&
        row.currentSessionStaffId &&
        row.currentSessionStartedAt &&
        (row.currentSessionStatus === "open" ||
          row.currentSessionStatus === "on_break")
          ? {
              id: row.currentSessionId,
              status: row.currentSessionStatus,
              staffId: row.currentSessionStaffId,
              staffName: row.currentSessionStaffName ?? "Unknown staff",
              startedAt: row.currentSessionStartedAt.toISOString(),
            }
          : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    })),
    total: countRows[0]?.count ?? 0,
    metrics: {
      total: metrics?.total ?? 0,
      active: metrics?.active ?? 0,
      inactive: metrics?.inactive ?? 0,
      online: metrics?.online ?? 0,
      offline: metrics?.offline ?? 0,
      never: metrics?.never ?? 0,
      syncIssues: metrics?.syncIssues ?? 0,
    },
  };
}

export async function findPosChannelDeviceRecordForUpdate(
  db: Database,
  input: {
    tenantId: string;
    terminalId: string;
    branchIds: string[];
  },
): Promise<typeof posTerminalSettings.$inferSelect | null> {
  if (input.branchIds.length === 0) return null;

  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, input.terminalId),
        eq(posTerminalSettings.tenantId, input.tenantId),
        inArray(posTerminalSettings.branchId, input.branchIds),
        sql`coalesce(${posTerminalSettings.metadata}->>'lastEnrollmentAction', '') <> 'revoked'`,
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
}

async function findStaffRoles(
  db: Database,
  input: {
    tenantId: string;
    staffIds: string[];
  },
): Promise<Map<string, "owner" | "manager" | "cashier">> {
  if (input.staffIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      userId: userRoles.userId,
      role: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(userRoles.tenantId, input.tenantId),
        inArray(userRoles.userId, input.staffIds),
        isNull(userRoles.revokedAt),
        inArray(roles.scope, ["tenant", "pos"]),
        inArray(roles.code, ["owner", "manager", "cashier"]),
        eq(roles.status, "active"),
        isNull(roles.deletedAt),
      ),
    );
  const result = new Map<string, "owner" | "manager" | "cashier">();

  for (const row of rows) {
    const role = row.role as "owner" | "manager" | "cashier";
    const current = result.get(row.userId);

    if (!current || STAFF_ROLE_PRIORITY[role] > STAFF_ROLE_PRIORITY[current]) {
      result.set(row.userId, role);
    }
  }

  return result;
}

export async function findPosChannelRegisterSessions(
  db: Database,
  input: SessionRepositoryInput,
): Promise<{
  data: PosChannelRegisterSession[];
  total: number;
  metrics: PosChannelRegisterSessionMetrics;
  currencies: string[];
}> {
  if (input.branchIds.length === 0) {
    return {
      data: [],
      total: 0,
      metrics: {
        total: 0,
        opened: 0,
        open: 0,
        onBreak: 0,
        closed: 0,
        cashAtOpen: null,
        cashActivity: null,
        cashAtClose: null,
        discrepancies: null,
        netSales: null,
        byCurrency: [],
      },
      currencies: [],
    };
  }

  const filtered = createSessionFilters(input, true);
  const scoped = createSessionFilters(input, false);
  const [rows, countRows, metricRows] = await Promise.all([
    db
      .select({
        id: posStaffShifts.id,
        branchId: posStaffShifts.branchId,
        branchName: branches.name,
        terminalId: posStaffShifts.terminalId,
        terminalDeviceId: posTerminalSettings.deviceId,
        terminalName: posTerminalSettings.label,
        staffId: posStaffShifts.staffId,
        staffName: userProfiles.displayName,
        staffEmail: users.email,
        currency: posStaffShifts.currency,
        status: posStaffShifts.status,
        startedAt: posStaffShifts.startedAt,
        endedAt: posStaffShifts.endedAt,
        openingFloat: posStaffShifts.openingFloat,
        closingFloat: posStaffShifts.closingFloat,
        createdAt: posStaffShifts.createdAt,
        updatedAt: posStaffShifts.updatedAt,
        version: posStaffShifts.version,
        zReportId: posZReports.id,
        zReportCutoffAt: posZReports.cutoffAt,
        zReportOrderCount: posZReports.orderCount,
        zReportGrossSales: posZReports.grossSales,
        zReportDiscountAmount: posZReports.discountAmount,
        zReportRefundAmount: posZReports.refundAmount,
        zReportCorrectionAmount: posZReports.correctionAmount,
        zReportExpectedCash: posZReports.expectedCash,
        zReportCountedCash: posZReports.countedCash,
        zReportVariance: posZReports.variance,
        zReportOutstandingOrders: posZReports.outstandingOrders,
      })
      .from(posStaffShifts)
      .innerJoin(
        branches,
        and(
          eq(branches.id, posStaffShifts.branchId),
          eq(branches.tenantId, posStaffShifts.tenantId),
        ),
      )
      .innerJoin(
        posTerminalSettings,
        and(
          eq(posTerminalSettings.id, posStaffShifts.terminalId),
          eq(posTerminalSettings.tenantId, posStaffShifts.tenantId),
          eq(posTerminalSettings.branchId, posStaffShifts.branchId),
        ),
      )
      .innerJoin(
        users,
        and(
          eq(users.id, posStaffShifts.staffId),
          eq(users.tenantId, posStaffShifts.tenantId),
        ),
      )
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, posStaffShifts.staffId),
          eq(userProfiles.tenantId, posStaffShifts.tenantId),
        ),
      )
      .leftJoin(
        posZReports,
        and(
          eq(posZReports.shiftId, posStaffShifts.id),
          eq(posZReports.tenantId, posStaffShifts.tenantId),
          eq(posZReports.branchId, posStaffShifts.branchId),
          eq(posZReports.terminalId, posStaffShifts.terminalId),
          eq(posZReports.currency, posStaffShifts.currency),
        ),
      )
      .where(and(...filtered))
      .orderBy(desc(posStaffShifts.startedAt), desc(posStaffShifts.id))
      .limit(input.query.limit)
      .offset(input.query.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posStaffShifts)
      .innerJoin(
        branches,
        and(
          eq(branches.id, posStaffShifts.branchId),
          eq(branches.tenantId, posStaffShifts.tenantId),
        ),
      )
      .innerJoin(
        posTerminalSettings,
        and(
          eq(posTerminalSettings.id, posStaffShifts.terminalId),
          eq(posTerminalSettings.tenantId, posStaffShifts.tenantId),
          eq(posTerminalSettings.branchId, posStaffShifts.branchId),
        ),
      )
      .innerJoin(
        users,
        and(
          eq(users.id, posStaffShifts.staffId),
          eq(users.tenantId, posStaffShifts.tenantId),
        ),
      )
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, posStaffShifts.staffId),
          eq(userProfiles.tenantId, posStaffShifts.tenantId),
        ),
      )
      .where(and(...filtered)),
    db
      .select({
        currency: posStaffShifts.currency,
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (
          where ${posStaffShifts.status} = 'open'
        )::int`,
        onBreak: sql<number>`count(*) filter (
          where ${posStaffShifts.status} = 'on_break'
        )::int`,
        closed: sql<number>`count(*) filter (
          where ${posStaffShifts.status} = 'closed'
        )::int`,
        cashAtOpen: sql<string>`coalesce(sum(${posStaffShifts.openingFloat}), 0)::text`,
        cashActivity: sql<string>`coalesce(sum(
          case when ${posZReports.id} is not null
            then ${posZReports.expectedCash} - ${posStaffShifts.openingFloat}
            else 0
          end
        ), 0)::text`,
        cashAtClose: sql<string>`coalesce(sum(
          case when ${posStaffShifts.status} = 'closed'
            then coalesce(${posZReports.countedCash}, ${posStaffShifts.closingFloat}, 0)
            else 0
          end
        ), 0)::text`,
        discrepancies: sql<string>`coalesce(sum(${posZReports.variance}), 0)::text`,
        netSales: sql<string>`coalesce(sum(
          ${posZReports.grossSales}
          - ${posZReports.discountAmount}
          - ${posZReports.refundAmount}
          + ${posZReports.correctionAmount}
        ), 0)::text`,
      })
      .from(posStaffShifts)
      .leftJoin(
        posZReports,
        and(
          eq(posZReports.shiftId, posStaffShifts.id),
          eq(posZReports.tenantId, posStaffShifts.tenantId),
          eq(posZReports.branchId, posStaffShifts.branchId),
          eq(posZReports.terminalId, posStaffShifts.terminalId),
          eq(posZReports.currency, posStaffShifts.currency),
        ),
      )
      .where(and(...scoped))
      .groupBy(posStaffShifts.currency)
      .orderBy(asc(posStaffShifts.currency)),
  ]);
  const rolesByStaff = await findStaffRoles(db, {
    tenantId: input.tenantId,
    staffIds: [...new Set(rows.map((row) => row.staffId))],
  });
  const byCurrency = metricRows.map((row) => ({
    currency: row.currency,
    cashAtOpen: toMoney(row.cashAtOpen),
    cashActivity: toMoney(row.cashActivity),
    cashAtClose: toMoney(row.cashAtClose),
    discrepancies: toMoney(row.discrepancies),
    netSales: toMoney(row.netSales),
  }));
  const singleCurrency = byCurrency.length === 1 ? byCurrency[0]! : null;
  const statusTotals = metricRows.reduce(
    (totals, row) => ({
      total: totals.total + row.total,
      open: totals.open + row.open,
      onBreak: totals.onBreak + row.onBreak,
      closed: totals.closed + row.closed,
    }),
    { total: 0, open: 0, onBreak: 0, closed: 0 },
  );

  return {
    data: rows.map((row) => {
      const startedAt = row.startedAt;
      const durationEnd = row.endedAt ?? new Date();
      const zReport =
        row.zReportId && row.zReportCutoffAt
          ? {
              id: row.zReportId,
              cutoffAt: row.zReportCutoffAt.toISOString(),
              orderCount: row.zReportOrderCount ?? 0,
              grossSales: toMoney(row.zReportGrossSales),
              refundAmount: toMoney(row.zReportRefundAmount),
              correctionAmount: toMoney(row.zReportCorrectionAmount),
              netSales: toMoney(
                toNumber(row.zReportGrossSales) -
                  toNumber(row.zReportDiscountAmount) -
                  toNumber(row.zReportRefundAmount) +
                  toNumber(row.zReportCorrectionAmount),
              ),
              expectedCash: toMoney(row.zReportExpectedCash),
              countedCash: toMoney(row.zReportCountedCash),
              variance: toMoney(row.zReportVariance),
              outstandingOrders: row.zReportOutstandingOrders ?? 0,
            }
          : null;

      return {
        id: row.id,
        branchId: row.branchId,
        branchName: row.branchName,
        terminalId: row.terminalId,
        terminalDeviceId: row.terminalDeviceId,
        terminalName: row.terminalName,
        staffId: row.staffId,
        staffName: row.staffName ?? "Unknown staff",
        staffEmail: row.staffEmail,
        staffRole: rolesByStaff.get(row.staffId) ?? null,
        currency: row.currency,
        status: row.status,
        startedAt: startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
        durationSeconds: Math.max(
          0,
          Math.floor((durationEnd.getTime() - startedAt.getTime()) / 1000),
        ),
        openingFloat: toMoney(row.openingFloat),
        closingFloat: toNullableNumber(row.closingFloat),
        cashActivity: zReport
          ? toMoney(zReport.expectedCash - toNumber(row.openingFloat))
          : null,
        netSales: zReport?.netSales ?? null,
        cashVariance: zReport?.variance ?? null,
        zReport,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        version: row.version,
      };
    }),
    total: countRows[0]?.count ?? 0,
    metrics: {
      total: statusTotals.total,
      opened: statusTotals.total,
      open: statusTotals.open,
      onBreak: statusTotals.onBreak,
      closed: statusTotals.closed,
      cashAtOpen: singleCurrency?.cashAtOpen ?? null,
      cashActivity: singleCurrency?.cashActivity ?? null,
      cashAtClose: singleCurrency?.cashAtClose ?? null,
      discrepancies: singleCurrency?.discrepancies ?? null,
      netSales: singleCurrency?.netSales ?? null,
      byCurrency,
    },
    currencies: byCurrency.map((item) => item.currency),
  };
}

function emptyFinancialMetrics(): BranchFinancialMetrics {
  return {
    grossSales: 0,
    returns: 0,
    grossProfit: 0,
    costCoverageAmount: 0,
    closedNetSales: 0,
    cashVariance: 0,
    expectedCash: 0,
    countedCash: 0,
    orderCount: 0,
  };
}

function emptyOperationalMetrics(): BranchOperationalMetrics {
  return {
    totalDevices: 0,
    activeDevices: 0,
    onlineDevices: 0,
    openSessions: 0,
    closedSessions: 0,
  };
}

export async function findPosChannelOverviewMetrics(
  db: Database,
  input: OverviewRepositoryInput,
): Promise<{
  metrics: PosChannelOverviewMetrics;
  branches: PosChannelBranchPerformance[];
  deviceSummary: PosChannelDeviceMetrics;
  cashTracking: PosChannelCashTrackingSummary;
}> {
  if (input.branchIds.length === 0) {
    return {
      metrics: {
        ...emptyOperationalMetrics(),
        ...emptyFinancialMetrics(),
      },
      branches: [],
      deviceSummary: {
        total: 0,
        active: 0,
        inactive: 0,
        online: 0,
        offline: 0,
        never: 0,
        syncIssues: 0,
      },
      cashTracking: {
        expectedCash: 0,
        countedCash: 0,
        variance: 0,
      },
    };
  }

  const orderFilters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    inArray(orders.branchId, input.branchIds),
    eq(orders.currency, input.currency),
    notInArray(orders.status, ["draft", "cancelled"]),
    isNull(orders.deletedAt),
  ];
  applyDateRange(orderFilters, orders.createdAt, input);
  const refundFilters: SQL[] = [
    eq(refundRequests.tenantId, input.tenantId),
    inArray(refundRequests.branchId, input.branchIds),
    eq(refundRequests.currency, input.currency),
    eq(refundRequests.status, "refunded"),
    isNotNull(refundRequests.refundedAt),
    isNull(refundRequests.deletedAt),
    sql`not exists (
      select 1
      from ${posPaymentAdjustments} as "linked_pos_refund"
      where "linked_pos_refund"."tenant_id" = ${refundRequests.tenantId}
        and "linked_pos_refund"."original_payment_id" = ${refundRequests.paymentTransactionId}
        and "linked_pos_refund"."adjustment_type" = 'refund'
    )`,
  ];
  applyDateRange(refundFilters, refundRequests.refundedAt, input);
  const adjustmentRefundFilters: SQL[] = [
    eq(posPaymentAdjustments.tenantId, input.tenantId),
    inArray(posPaymentAdjustments.branchId, input.branchIds),
    eq(posPaymentAdjustments.currency, input.currency),
    eq(posPaymentAdjustments.adjustmentType, "refund"),
  ];
  applyDateRange(
    adjustmentRefundFilters,
    posPaymentAdjustments.occurredAt,
    input,
  );
  const zReportFilters: SQL[] = [
    eq(posZReports.tenantId, input.tenantId),
    inArray(posZReports.branchId, input.branchIds),
    eq(posZReports.currency, input.currency),
  ];
  applyDateRange(zReportFilters, posZReports.cutoffAt, input);
  const closedShiftFilters: SQL[] = [
    eq(posStaffShifts.tenantId, input.tenantId),
    inArray(posStaffShifts.branchId, input.branchIds),
    eq(posStaffShifts.status, "closed"),
  ];
  applyDateRange(closedShiftFilters, posStaffShifts.endedAt, input);
  const offlineAt = new Date(
    input.generatedAt.getTime() - input.deviceOfflineAfterSeconds * 1000,
  );
  const overviewDeviceConnectivity = createConnectivityExpression(
    offlineAt,
    input.generatedAt,
  );

  const [
    orderRows,
    refundRows,
    adjustmentReturnRows,
    costRows,
    zReportRows,
    deviceRows,
    openSessionRows,
    closedSessionRows,
  ] = await Promise.all([
    db
      .select({
        branchId: orders.branchId,
        grossSales: sql<string>`coalesce(sum(${orders.subtotalAmount}), 0)::text`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(...orderFilters))
      .groupBy(orders.branchId),
    db
      .select({
        branchId: refundRequests.branchId,
        returns: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      })
      .from(refundRequests)
      .where(and(...refundFilters))
      .groupBy(refundRequests.branchId),
    db
      .select({
        branchId: posPaymentAdjustments.branchId,
        returns: sql<string>`coalesce(sum(
          case
            when ${posPaymentAdjustments.direction} = 'debit'
              then ${posPaymentAdjustments.amount}
            else -${posPaymentAdjustments.amount}
          end
        ), 0)::text`,
      })
      .from(posPaymentAdjustments)
      .where(and(...adjustmentRefundFilters))
      .groupBy(posPaymentAdjustments.branchId),
    db
      .select({
        branchId: orderItems.branchId,
        costCoverageAmount: sql<string>`coalesce(sum(
          ${orderItems.lineAmount} - coalesce((
            select sum(${orderDiscountAllocations.amount})
            from ${orderDiscountAllocations}
            inner join ${orderDiscountApplications}
              on ${orderDiscountApplications.tenantId} = ${orderDiscountAllocations.tenantId}
              and ${orderDiscountApplications.id} = ${orderDiscountAllocations.applicationId}
            where ${orderDiscountAllocations.tenantId} = ${orderItems.tenantId}
              and ${orderDiscountAllocations.orderItemId} = ${orderItems.id}
              and ${orderDiscountApplications.status} = 'applied'
          ), 0)
        ), 0)::text`,
        grossProfit: sql<string>`coalesce(sum(
          ${orderItems.lineAmount}
          - coalesce((
            select sum(${orderDiscountAllocations.amount})
            from ${orderDiscountAllocations}
            inner join ${orderDiscountApplications}
              on ${orderDiscountApplications.tenantId} = ${orderDiscountAllocations.tenantId}
              and ${orderDiscountApplications.id} = ${orderDiscountAllocations.applicationId}
            where ${orderDiscountAllocations.tenantId} = ${orderItems.tenantId}
              and ${orderDiscountAllocations.orderItemId} = ${orderItems.id}
              and ${orderDiscountApplications.status} = 'applied'
          ), 0)
          -
          (${orderItems.unitCostAmount} * ${orderItems.quantity})
        ), 0)::text`,
      })
      .from(orderItems)
      .innerJoin(
        orders,
        and(
          eq(orders.id, orderItems.orderId),
          eq(orders.tenantId, orderItems.tenantId),
          eq(orders.branchId, orderItems.branchId),
        ),
      )
      .where(
        and(
          ...orderFilters,
          eq(orderItems.tenantId, input.tenantId),
          inArray(orderItems.branchId, input.branchIds),
          isNull(orderItems.deletedAt),
          isNotNull(orderItems.unitCostAmount),
        ),
      )
      .groupBy(orderItems.branchId),
    db
      .select({
        branchId: posZReports.branchId,
        closedNetSales: sql<string>`coalesce(sum(
          ${posZReports.grossSales}
          - ${posZReports.discountAmount}
          - ${posZReports.refundAmount}
          + ${posZReports.correctionAmount}
        ), 0)::text`,
        cashVariance: sql<string>`coalesce(sum(${posZReports.variance}), 0)::text`,
        expectedCash: sql<string>`coalesce(sum(${posZReports.expectedCash}), 0)::text`,
        countedCash: sql<string>`coalesce(sum(${posZReports.countedCash}), 0)::text`,
      })
      .from(posZReports)
      .where(and(...zReportFilters))
      .groupBy(posZReports.branchId),
    db
      .select({
        branchId: posTerminalSettings.branchId,
        totalDevices: sql<number>`count(*)::int`,
        activeDevices: sql<number>`count(*) filter (
          where ${posTerminalSettings.status} = 'active'
        )::int`,
        inactiveDevices: sql<number>`count(*) filter (
          where ${posTerminalSettings.status} = 'inactive'
        )::int`,
        onlineDevices: sql<number>`count(*) filter (
          where ${overviewDeviceConnectivity} = 'online'
        )::int`,
        offlineDevices: sql<number>`count(*) filter (
          where ${overviewDeviceConnectivity} = 'offline'
        )::int`,
        neverSeenDevices: sql<number>`count(*) filter (
          where ${overviewDeviceConnectivity} = 'never'
        )::int`,
        syncIssues: sql<number>`count(*) filter (
          where ${posTerminalSettings.syncStatus} = 'error'
        )::int`,
      })
      .from(posTerminalSettings)
      .where(
        and(
          eq(posTerminalSettings.tenantId, input.tenantId),
          inArray(posTerminalSettings.branchId, input.branchIds),
          sql`coalesce(${posTerminalSettings.metadata}->>'lastEnrollmentAction', '') <> 'revoked'`,
        ),
      )
      .groupBy(posTerminalSettings.branchId),
    db
      .select({
        branchId: posStaffShifts.branchId,
        openSessions: sql<number>`count(*)::int`,
      })
      .from(posStaffShifts)
      .where(
        and(
          eq(posStaffShifts.tenantId, input.tenantId),
          inArray(posStaffShifts.branchId, input.branchIds),
          ne(posStaffShifts.status, "closed"),
        ),
      )
      .groupBy(posStaffShifts.branchId),
    db
      .select({
        branchId: posStaffShifts.branchId,
        closedSessions: sql<number>`count(*)::int`,
      })
      .from(posStaffShifts)
      .where(and(...closedShiftFilters))
      .groupBy(posStaffShifts.branchId),
  ]);

  const financialByBranch = new Map<string, BranchFinancialMetrics>();
  const operationalByBranch = new Map<string, BranchOperationalMetrics>();
  const ensureFinancial = (branchId: string) => {
    const metrics = financialByBranch.get(branchId) ?? emptyFinancialMetrics();
    financialByBranch.set(branchId, metrics);
    return metrics;
  };
  const ensureOperational = (branchId: string) => {
    const metrics =
      operationalByBranch.get(branchId) ?? emptyOperationalMetrics();
    operationalByBranch.set(branchId, metrics);
    return metrics;
  };

  for (const row of orderRows) {
    Object.assign(ensureFinancial(row.branchId), {
      grossSales: toMoney(row.grossSales),
      orderCount: row.orderCount,
    });
  }
  for (const row of [...refundRows, ...adjustmentReturnRows]) {
    const financial = ensureFinancial(row.branchId);
    financial.returns = toMoney(financial.returns + toNumber(row.returns));
  }
  for (const row of costRows) {
    Object.assign(ensureFinancial(row.branchId), {
      grossProfit: toMoney(row.grossProfit),
      costCoverageAmount: toMoney(row.costCoverageAmount),
    });
  }
  for (const row of zReportRows) {
    Object.assign(ensureFinancial(row.branchId), {
      closedNetSales: toMoney(row.closedNetSales),
      cashVariance: toMoney(row.cashVariance),
      expectedCash: toMoney(row.expectedCash),
      countedCash: toMoney(row.countedCash),
    });
  }
  for (const row of deviceRows) {
    Object.assign(ensureOperational(row.branchId), {
      totalDevices: row.totalDevices,
      activeDevices: row.activeDevices,
      onlineDevices: row.onlineDevices,
    });
  }
  for (const row of openSessionRows) {
    ensureOperational(row.branchId).openSessions = row.openSessions;
  }
  for (const row of closedSessionRows) {
    ensureOperational(row.branchId).closedSessions = row.closedSessions;
  }

  const selectedBranches = input.availableBranches.filter((branch) =>
    input.branchIds.includes(branch.id),
  );
  const branchPerformance = selectedBranches.map((branch) => ({
    branchId: branch.id,
    branchName: branch.name,
    currency: input.currency,
    ...ensureOperational(branch.id),
    ...ensureFinancial(branch.id),
  }));
  const totals = branchPerformance.reduce(
    (result, branch) => {
      for (const key of [
        "totalDevices",
        "activeDevices",
        "onlineDevices",
        "openSessions",
        "closedSessions",
        "grossSales",
        "returns",
        "grossProfit",
        "costCoverageAmount",
        "closedNetSales",
        "cashVariance",
        "orderCount",
      ] as const) {
        result[key] += branch[key];
      }

      return result;
    },
    {
      ...emptyOperationalMetrics(),
      grossSales: 0,
      returns: 0,
      grossProfit: 0,
      costCoverageAmount: 0,
      closedNetSales: 0,
      cashVariance: 0,
      orderCount: 0,
    },
  );
  const deviceSummary = deviceRows.reduce<PosChannelDeviceMetrics>(
    (result, row) => ({
      total: result.total + row.totalDevices,
      active: result.active + row.activeDevices,
      inactive: result.inactive + row.inactiveDevices,
      online: result.online + row.onlineDevices,
      offline: result.offline + row.offlineDevices,
      never: result.never + row.neverSeenDevices,
      syncIssues: result.syncIssues + row.syncIssues,
    }),
    {
      total: 0,
      active: 0,
      inactive: 0,
      online: 0,
      offline: 0,
      never: 0,
      syncIssues: 0,
    },
  );
  const cashTracking = branchPerformance.reduce<PosChannelCashTrackingSummary>(
    (result, branch) => ({
      expectedCash: toMoney(result.expectedCash + branch.expectedCash),
      countedCash: toMoney(result.countedCash + branch.countedCash),
      variance: toMoney(result.variance + branch.cashVariance),
    }),
    { expectedCash: 0, countedCash: 0, variance: 0 },
  );

  return {
    metrics: totals,
    branches: branchPerformance.map(
      ({ expectedCash: _expectedCash, countedCash: _countedCash, ...branch }) =>
        branch,
    ),
    deviceSummary,
    cashTracking,
  };
}

export async function findPosChannelStaffSummary(
  db: Database,
  input: ScopedRepositoryInput,
): Promise<PosChannelStaffSummary> {
  if (input.branchIds.length === 0) {
    return { onDutyCount: 0, onBreakCount: 0, offDutyCount: 0 };
  }

  const [roleRows, assignmentRows, shiftRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        role: roles.code,
        roleBranchId: userRoles.branchId,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.userType, "tenant"),
          eq(users.status, "active"),
          isNull(users.deletedAt),
          eq(userRoles.tenantId, input.tenantId),
          isNull(userRoles.revokedAt),
          inArray(roles.scope, ["tenant", "pos"]),
          inArray(roles.code, ["owner", "manager", "cashier"]),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      ),
    db
      .select({ userId: userBranches.userId })
      .from(userBranches)
      .where(
        and(
          eq(userBranches.tenantId, input.tenantId),
          inArray(userBranches.branchId, input.branchIds),
        ),
      ),
    db
      .select({
        staffId: posStaffShifts.staffId,
        status: posStaffShifts.status,
      })
      .from(posStaffShifts)
      .where(
        and(
          eq(posStaffShifts.tenantId, input.tenantId),
          inArray(posStaffShifts.branchId, input.branchIds),
          ne(posStaffShifts.status, "closed"),
        ),
      ),
  ]);
  const assignedUserIds = new Set(
    assignmentRows.map((assignment) => assignment.userId),
  );
  const eligibleUserIds = new Set(
    roleRows
      .filter(
        (row) =>
          row.role === "owner" ||
          (row.roleBranchId !== null &&
            input.branchIds.includes(row.roleBranchId)) ||
          assignedUserIds.has(row.userId),
      )
      .map((row) => row.userId),
  );
  const total = eligibleUserIds.size;
  const onDutyCount = shiftRows.filter(
    (shift) => eligibleUserIds.has(shift.staffId) && shift.status === "open",
  ).length;
  const onBreakCount = shiftRows.filter(
    (shift) =>
      eligibleUserIds.has(shift.staffId) && shift.status === "on_break",
  ).length;

  return {
    onDutyCount,
    onBreakCount,
    offDutyCount: Math.max(0, total - onDutyCount - onBreakCount),
  };
}
