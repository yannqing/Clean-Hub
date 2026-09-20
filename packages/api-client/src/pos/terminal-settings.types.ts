import type { PosMobileMoneyProvider } from "./orders.types";

export type PosPaymentMethod = "cash" | "card" | "app";
export type PosCashHandlingMode =
  | "none"
  | "untracked"
  | "shared_drawer"
  | "cash_in_hand";
export type PosRoundingRule = "none" | "round_yuan" | "round_jiao";
export type PosTerminalSettingsStatus = "active" | "inactive";
export type PosTerminalDeviceType =
  | "unknown"
  | "desktop"
  | "tablet"
  | "phone"
  | "browser";
export type PosTerminalSyncStatus = "never" | "syncing" | "synced" | "error";

export type PosTerminalSettings = {
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
  cashHandlingMode: PosCashHandlingMode;
  cashTrackingEnabled: boolean;
  requireOpeningFloat: boolean;
  requireClosingCount: boolean;
  mobileMoneyProvidersEnabled: PosMobileMoneyProvider[];
  roundingRule: PosRoundingRule;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  /**
   * Whether this till may offer an emailed receipt. False when the platform has
   * no SMTP configured, or when the tenant is not entitled to email.
   */
  emailReceiptEnabled: boolean;
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

export type UpdatePosTerminalSettingsRequest = {
  label?: string;
  defaultPaymentMethod?: PosPaymentMethod;
  paymentMethodsEnabled?: PosPaymentMethod[];
  cashHandlingMode?: PosCashHandlingMode;
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
