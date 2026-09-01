import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

/**
 * POS terminal settings — DTOs.
 *
 * The string-literal unions mirror the Drizzle enums defined in
 * `packages/db/src/schema/tenancy/pos-terminal-settings.ts`.
 */

export type PosPaymentMethod = "cash" | "card" | "app";

export type PosRoundingRule = "none" | "round_yuan" | "round_jiao";

export type PosTerminalSettingsStatus = "active" | "inactive";
export type PosTerminalDeviceType =
  | "unknown"
  | "desktop"
  | "tablet"
  | "phone"
  | "browser";
export type PosTerminalSyncStatus = "never" | "syncing" | "synced" | "error";

export type PosTerminalSettingsSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  label: string | null;
  deviceType: PosTerminalDeviceType;
  platform: string | null;
  platformVersion: string | null;
  appVersion: string | null;
  defaultPaymentMethod: PosPaymentMethod;
  paymentMethodsEnabled: PosPaymentMethod[];
  roundingRule: PosRoundingRule;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  autoPrintReceipt: boolean;
  printCopies: number;
  lockTimeoutSeconds: number;
  status: PosTerminalSettingsStatus;
  lastSeenAt: string | null;
  lastRealtimeSeenAt: string | null;
  connectionLeaseUntil: string | null;
  lastDisconnectedAt: string | null;
  lastDisconnectReason: string | null;
  pendingSalesCount: number | null;
  pendingOperationsCount: number | null;
  oldestPendingAt: string | null;
  statusRevision: number;
  realtimeProtocolVersion: number | null;
  syncStatus: PosTerminalSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
};

export type CreatePosTerminalSettingsRequest = {
  branchId: string;
  deviceId: string;
  label?: string;
  defaultPaymentMethod?: PosPaymentMethod;
  paymentMethodsEnabled?: PosPaymentMethod[];
  roundingRule?: PosRoundingRule;
  autoPrintReceipt?: boolean;
  printCopies?: number;
  lockTimeoutSeconds?: number;
};

export type UpdatePosTerminalSettingsRequest = {
  label?: string;
  defaultPaymentMethod?: PosPaymentMethod;
  paymentMethodsEnabled?: PosPaymentMethod[];
  roundingRule?: PosRoundingRule;
  autoPrintReceipt?: boolean;
  printCopies?: number;
  lockTimeoutSeconds?: number;
};

export type PosTerminalHeartbeatRequest = {
  deviceType?: PosTerminalDeviceType;
  platform?: string | null;
  platformVersion?: string | null;
  appVersion?: string | null;
  syncStatus?: PosTerminalSyncStatus;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  pendingSalesCount?: number;
  pendingOperationsCount?: number;
  oldestPendingAt?: string | null;
};

export type PosTerminalSettingsInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};
