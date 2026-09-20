import { and, eq, sql } from "drizzle-orm";

import {
  branches,
  posChannelSettings,
  posTerminalSettings,
  tenantFeatureFlags,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  CreatePosTerminalSettingsRequest,
  PosTerminalHeartbeatRequest,
  PosTerminalSettingsSummary,
  UpdatePosTerminalSettingsRequest,
} from "./terminal-settings.types.js";

export type AuthenticatedTerminalIdentity = {
  tenantId: string;
  terminalId: string;
  branchId: string;
  deviceId: string;
  credentialVersion: number;
};

function toSummary(
  row: typeof posTerminalSettings.$inferSelect,
): PosTerminalSettingsSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    deviceId: row.deviceId,
    label: row.label,
    deviceType: row.deviceType,
    platform: row.platform,
    platformVersion: row.platformVersion,
    appVersion: row.appVersion,
    // Payment policy lives on the branch; withTenantFinancialDefaults overlays
    // the real values. These placeholders keep the row shape complete.
    defaultPaymentMethod: "cash",
    paymentMethodsEnabled: ["cash", "app"],
    cashHandlingMode: "shared_drawer",
    cashTrackingEnabled: true,
    requireOpeningFloat: true,
    requireClosingCount: true,
    mobileMoneyProvidersEnabled: [],
    roundingRule: row.roundingRule,
    taxEnabled: false,
    defaultTaxRate: "0.0000",
    pricesIncludeTax: true,
    taxRegistrationNumber: null,
    // Safe placeholder: withTenantFinancialDefaults resolves the real value
    // from the platform SMTP configuration and the tenant's feature flag.
    // Defaulting to false means a path that somehow skips the overlay hides
    // the email option rather than offering one that cannot send.
    emailReceiptEnabled: false,
    autoPrintReceipt: row.autoPrintReceipt,
    printCopies: row.printCopies,
    lockTimeoutSeconds: row.lockTimeoutSeconds,
    status: row.status,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    lastRealtimeSeenAt: row.lastRealtimeSeenAt?.toISOString() ?? null,
    connectionLeaseUntil: row.connectionLeaseUntil?.toISOString() ?? null,
    lastDisconnectedAt: row.lastDisconnectedAt?.toISOString() ?? null,
    lastDisconnectReason: row.lastDisconnectReason,
    pendingSalesCount: row.pendingSalesCount,
    pendingOperationsCount: row.pendingOperationsCount,
    oldestPendingAt: row.oldestPendingAt?.toISOString() ?? null,
    statusRevision: row.statusRevision,
    realtimeProtocolVersion: row.realtimeProtocolVersion,
    syncStatus: row.syncStatus,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

/**
 * Whether this tenant is entitled to send email.
 *
 * Defaults to false when the tenant has no feature-flag row: email is opt-in,
 * and a missing row must not silently grant it.
 */
export async function findTenantEmailEnabled(
  db: Database,
  tenantId: string,
): Promise<boolean> {
  const rows = await db
    .select({ emailEnabled: tenantFeatureFlags.emailEnabled })
    .from(tenantFeatureFlags)
    .where(eq(tenantFeatureFlags.tenantId, tenantId))
    .limit(1);

  return rows[0]?.emailEnabled ?? false;
}

export async function findTenantPosTerminalDefaults(
  db: Database,
  tenantId: string,
): Promise<{
  cashTrackingEnabled: boolean;
  requireOpeningFloat: boolean;
  requireClosingCount: boolean;
  roundingRule: "none" | "round_yuan" | "round_jiao";
  autoPrintReceipt: boolean;
  printCopies: number;
  lockTimeoutSeconds: number;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
}> {
  const rows = await db
    .select({
      cashTrackingEnabled: posChannelSettings.cashTrackingEnabled,
      requireOpeningFloat: posChannelSettings.requireOpeningFloat,
      requireClosingCount: posChannelSettings.requireClosingCount,
      roundingRule: posChannelSettings.defaultRoundingRule,
      autoPrintReceipt: posChannelSettings.defaultAutoPrintReceipt,
      printCopies: posChannelSettings.defaultPrintCopies,
      lockTimeoutSeconds: posChannelSettings.defaultLockTimeoutSeconds,
      taxEnabled: posChannelSettings.taxEnabled,
      defaultTaxRate: posChannelSettings.defaultTaxRate,
      pricesIncludeTax: posChannelSettings.pricesIncludeTax,
      taxRegistrationNumber: posChannelSettings.taxRegistrationNumber,
    })
    .from(posChannelSettings)
    .where(eq(posChannelSettings.tenantId, tenantId))
    .limit(1);

  return (
    rows[0] ?? {
      cashTrackingEnabled: true,
      requireOpeningFloat: true,
      requireClosingCount: true,
      roundingRule: "none",
      autoPrintReceipt: true,
      printCopies: 1,
      lockTimeoutSeconds: 300,
      taxEnabled: false,
      defaultTaxRate: "0.0000",
      pricesIncludeTax: true,
      taxRegistrationNumber: null,
    }
  );
}

export type BranchPaymentPolicy = {
  paymentMethodsEnabled: Array<"cash" | "card" | "app">;
  defaultPaymentMethod: "cash" | "card" | "app";
  cashHandlingMode: "none" | "untracked" | "shared_drawer" | "cash_in_hand";
};

/**
 * Cash and payment policy is owned by the branch, so a store with a physical
 * drawer and one whose staff carry cash can differ under the same tenant.
 */
export async function findBranchPaymentPolicy(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<BranchPaymentPolicy | null> {
  const rows = await db
    .select({
      paymentMethodsEnabled: branches.paymentMethodsEnabled,
      defaultPaymentMethod: branches.defaultPaymentMethod,
      cashHandlingMode: branches.cashHandlingMode,
    })
    .from(branches)
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findTerminalSettingsByTenantAndDevice(
  db: Database,
  tenantId: string,
  deviceId: string,
): Promise<PosTerminalSettingsSummary | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.deviceId, deviceId),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function findTerminalSettingsById(
  db: Database,
  tenantId: string,
  id: string,
): Promise<PosTerminalSettingsSummary | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, id),
        eq(posTerminalSettings.tenantId, tenantId),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function findAuthenticatedTerminalSettings(
  db: Database,
  terminal: AuthenticatedTerminalIdentity,
): Promise<PosTerminalSettingsSummary | null> {
  const rows = await db
    .select()
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, terminal.terminalId),
        eq(posTerminalSettings.tenantId, terminal.tenantId),
        eq(posTerminalSettings.branchId, terminal.branchId),
        eq(posTerminalSettings.deviceId, terminal.deviceId),
        eq(posTerminalSettings.credentialVersion, terminal.credentialVersion),
        eq(posTerminalSettings.status, "active"),
      ),
    )
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function insertTerminalSettings(
  db: Database,
  tenantId: string,
  actorUserId: string,
  input: CreatePosTerminalSettingsRequest,
): Promise<PosTerminalSettingsSummary> {
  const id = createId();
  const rows = await db
    .insert(posTerminalSettings)
    .values({
      id,
      tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      label: input.label ?? null,
      roundingRule: input.roundingRule ?? "none",
      autoPrintReceipt: input.autoPrintReceipt ?? true,
      printCopies: input.printCopies ?? 1,
      lockTimeoutSeconds: input.lockTimeoutSeconds ?? 300,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .returning();

  return toSummary(rows[0]!);
}

export async function updateTerminalSettingsRecord(
  db: Database,
  terminal: AuthenticatedTerminalIdentity,
  actorUserId: string,
  input: UpdatePosTerminalSettingsRequest,
  currentVersion: number,
): Promise<PosTerminalSettingsSummary | null> {
  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: actorUserId,
    version: currentVersion + 1,
  };

  if (input.label !== undefined) setValues.label = input.label;
  if (input.roundingRule !== undefined)
    setValues.roundingRule = input.roundingRule;
  if (input.autoPrintReceipt !== undefined)
    setValues.autoPrintReceipt = input.autoPrintReceipt;
  if (input.printCopies !== undefined)
    setValues.printCopies = input.printCopies;
  if (input.lockTimeoutSeconds !== undefined)
    setValues.lockTimeoutSeconds = input.lockTimeoutSeconds;

  const rows = await db
    .update(posTerminalSettings)
    .set(setValues)
    .where(
      and(
        eq(posTerminalSettings.id, terminal.terminalId),
        eq(posTerminalSettings.tenantId, terminal.tenantId),
        eq(posTerminalSettings.branchId, terminal.branchId),
        eq(posTerminalSettings.deviceId, terminal.deviceId),
        eq(posTerminalSettings.credentialVersion, terminal.credentialVersion),
        eq(posTerminalSettings.status, "active"),
        eq(posTerminalSettings.version, currentVersion),
      ),
    )
    .returning();

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function updateAuthenticatedTerminalLastSeen(
  db: Database,
  terminal: AuthenticatedTerminalIdentity,
): Promise<void> {
  await db
    .update(posTerminalSettings)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(posTerminalSettings.id, terminal.terminalId),
        eq(posTerminalSettings.tenantId, terminal.tenantId),
        eq(posTerminalSettings.branchId, terminal.branchId),
        eq(posTerminalSettings.deviceId, terminal.deviceId),
        eq(posTerminalSettings.credentialVersion, terminal.credentialVersion),
        eq(posTerminalSettings.status, "active"),
      ),
    );
}

export async function updateTerminalHeartbeat(
  db: Database,
  input: {
    terminal: AuthenticatedTerminalIdentity;
    data: PosTerminalHeartbeatRequest;
  },
): Promise<PosTerminalSettingsSummary | null> {
  const setValues: Record<string, unknown> = {
    lastSeenAt: new Date(),
    statusRevision: sql`${posTerminalSettings.statusRevision} + 1`,
  };

  if (input.data.deviceType !== undefined) {
    setValues.deviceType = input.data.deviceType;
  }
  if (input.data.platform !== undefined) {
    setValues.platform = input.data.platform;
  }
  if (input.data.platformVersion !== undefined) {
    setValues.platformVersion = input.data.platformVersion;
  }
  if (input.data.appVersion !== undefined) {
    setValues.appVersion = input.data.appVersion;
  }
  if (input.data.syncStatus !== undefined) {
    setValues.syncStatus = input.data.syncStatus;
  }
  if (input.data.lastSyncedAt !== undefined) {
    setValues.lastSyncedAt = input.data.lastSyncedAt
      ? new Date(input.data.lastSyncedAt)
      : null;
  }
  if (input.data.lastSyncError !== undefined) {
    setValues.lastSyncError = input.data.lastSyncError;
  }
  if (input.data.pendingSalesCount !== undefined) {
    setValues.pendingSalesCount = input.data.pendingSalesCount;
  }
  if (input.data.pendingOperationsCount !== undefined) {
    setValues.pendingOperationsCount = input.data.pendingOperationsCount;
  }
  if (input.data.oldestPendingAt !== undefined) {
    setValues.oldestPendingAt = input.data.oldestPendingAt
      ? new Date(input.data.oldestPendingAt)
      : null;
  }

  const rows = await db
    .update(posTerminalSettings)
    .set(setValues)
    .where(
      and(
        eq(posTerminalSettings.id, input.terminal.terminalId),
        eq(posTerminalSettings.tenantId, input.terminal.tenantId),
        eq(posTerminalSettings.branchId, input.terminal.branchId),
        eq(posTerminalSettings.deviceId, input.terminal.deviceId),
        eq(
          posTerminalSettings.credentialVersion,
          input.terminal.credentialVersion,
        ),
        eq(posTerminalSettings.status, "active"),
      ),
    )
    .returning();

  return rows[0] ? toSummary(rows[0]) : null;
}
