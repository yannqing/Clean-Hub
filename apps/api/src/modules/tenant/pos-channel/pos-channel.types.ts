import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import type {
  PosTerminalConnectionState,
  PosTerminalOperationalStatus,
  PosTerminalServiceHealth,
} from "@cleanhub/domain/pos-terminal-status";
import type { TenantPaymentProvider } from "../payment-integrations/payment-integrations.types.js";

export type PosChannelPaymentMethod = "cash" | "card" | "app";
export type PosChannelRoundingRule = "none" | "round_yuan" | "round_jiao";
export type PosChannelDeviceStatus = "active" | "inactive";
export type PosChannelDeviceConnectivity = "online" | "offline" | "never";
export type PosChannelDeviceType =
  | "unknown"
  | "desktop"
  | "tablet"
  | "phone"
  | "browser";
export type PosChannelSyncStatus = "never" | "syncing" | "synced" | "error";
export type PosChannelShiftStatus = "open" | "on_break" | "closed";

export type PosChannelAvailableBranch = {
  id: string;
  name: string;
  status: "active" | "inactive";
  currency: string;
};

export type PosChannelOverviewQuery = {
  from?: string;
  to?: string;
  branchId?: string;
  currency?: string;
};

export type PosChannelOverviewMetrics = {
  totalDevices: number;
  activeDevices: number;
  onlineDevices: number;
  openSessions: number;
  closedSessions: number;
  grossSales: number;
  returns: number;
  grossProfit: number;
  /**
   * Revenue represented by order items that have a stored unit cost.
   * Gross profit is calculated only from this covered amount.
   */
  costCoverageAmount: number;
  closedNetSales: number;
  cashVariance: number;
  orderCount: number;
};

export type PosChannelBranchPerformance = {
  branchId: string;
  branchName: string;
  currency: string;
  totalDevices: number;
  activeDevices: number;
  onlineDevices: number;
  openSessions: number;
  closedSessions: number;
  grossSales: number;
  returns: number;
  grossProfit: number;
  costCoverageAmount: number;
  closedNetSales: number;
  cashVariance: number;
  orderCount: number;
};

export type PosChannelDeviceMetrics = {
  total: number;
  active: number;
  inactive: number;
  online: number;
  offline: number;
  never: number;
  syncIssues: number;
};

export type PosChannelCurrentSession = {
  id: string;
  status: Extract<PosChannelShiftStatus, "open" | "on_break">;
  staffId: string;
  staffName: string;
  startedAt: string;
};

export type PosChannelDeviceSummary = {
  id: string;
  deviceId: string;
  label: string | null;
  branchId: string;
  branchName: string;
  status: PosChannelDeviceStatus;
  connectivity: PosChannelDeviceConnectivity;
  operationalStatus: PosTerminalOperationalStatus;
  connectionState: PosTerminalConnectionState;
  serviceHealth: PosTerminalServiceHealth;
  deviceType: PosChannelDeviceType;
  platform: string | null;
  platformVersion: string | null;
  appVersion: string | null;
  syncStatus: PosChannelSyncStatus;
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
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  credentialVersion: number;
  credentialIssuedAt: string | null;
  credentialRotatedAt: string | null;
  credentialLastUsedAt: string | null;
  defaultPaymentMethod: PosChannelPaymentMethod;
  roundingRule: PosChannelRoundingRule;
  autoPrintReceipt: boolean;
  printCopies: number;
  lockTimeoutSeconds: number;
  currentSession: PosChannelCurrentSession | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosChannelDeviceListQuery = {
  branchId?: string;
  status?: PosChannelDeviceStatus;
  connectivity?: PosChannelDeviceConnectivity;
  q?: string;
  limit: number;
  offset: number;
};

export type PosChannelDeviceList = {
  data: PosChannelDeviceSummary[];
  total: number;
  limit: number;
  offset: number;
  metrics: PosChannelDeviceMetrics;
  availableBranches: PosChannelAvailableBranch[];
  generatedAt: string;
  deviceOfflineAfterSeconds: number;
};

export type UpdatePosChannelDeviceRequest = {
  label?: string;
  branchId?: string;
  status?: PosChannelDeviceStatus;
  reason: string;
  version: number;
};

export type RemovePosChannelDeviceRequest = {
  reason: string;
  version: number;
};

export type PosChannelDeviceMutationResult = {
  id: string;
  version: number;
};

export type PosChannelZReportSummary = {
  id: string;
  cutoffAt: string;
  orderCount: number;
  grossSales: number;
  refundAmount: number;
  correctionAmount: number;
  netSales: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  outstandingOrders: number;
};

export type PosChannelRegisterSession = {
  id: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalDeviceId: string;
  terminalName: string | null;
  staffId: string;
  staffName: string;
  staffEmail: string | null;
  staffRole: "owner" | "manager" | "cashier" | null;
  currency: string;
  status: PosChannelShiftStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  openingFloat: number;
  closingFloat: number | null;
  cashActivity: number | null;
  netSales: number | null;
  cashVariance: number | null;
  zReport: PosChannelZReportSummary | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosChannelRegisterSessionQuery = {
  from?: string;
  to?: string;
  branchId?: string;
  status?: PosChannelShiftStatus;
  q?: string;
  limit: number;
  offset: number;
};

export type PosChannelCurrencySessionMetrics = {
  currency: string;
  cashAtOpen: number;
  cashActivity: number;
  cashAtClose: number;
  discrepancies: number;
  netSales: number;
};

export type PosChannelRegisterSessionMetrics = {
  total: number;
  opened: number;
  open: number;
  onBreak: number;
  closed: number;
  /**
   * Monetary totals are null when the result includes multiple currencies.
   * `byCurrency` always contains the lossless breakdown.
   */
  cashAtOpen: number | null;
  cashActivity: number | null;
  cashAtClose: number | null;
  discrepancies: number | null;
  netSales: number | null;
  byCurrency: PosChannelCurrencySessionMetrics[];
};

export type PosChannelRegisterSessionList = {
  data: PosChannelRegisterSession[];
  total: number;
  limit: number;
  offset: number;
  metrics: PosChannelRegisterSessionMetrics;
  currency: string | null;
  timezone: string;
  availableCurrencies: string[];
  availableBranches: PosChannelAvailableBranch[];
  filters: {
    from: string;
    to: string;
    branchId: string | null;
    status: PosChannelShiftStatus | null;
    q: string | null;
  };
  generatedAt: string;
};

export type PosChannelSettings = {
  id: string | null;
  tenantId: string;
  cashTrackingEnabled: boolean;
  requireOpeningFloat: boolean;
  requireClosingCount: boolean;
  requireReturnReason: boolean;
  recentCartRetentionHours: number;
  offlineModeEnabled: boolean;
  syncIntervalSeconds: number;
  deviceOfflineAfterSeconds: number;
  defaultPaymentMethod: PosChannelPaymentMethod;
  defaultPaymentMethodsEnabled: PosChannelPaymentMethod[];
  mobileMoneyProvidersEnabled: TenantPaymentProvider[];
  defaultRoundingRule: PosChannelRoundingRule;
  taxEnabled: boolean;
  defaultTaxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  defaultAutoPrintReceipt: boolean;
  defaultPrintCopies: number;
  defaultLockTimeoutSeconds: number;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
  canManage: boolean;
};

export type UpdatePosChannelSettingsRequest = {
  cashTrackingEnabled?: boolean;
  requireOpeningFloat?: boolean;
  requireClosingCount?: boolean;
  requireReturnReason?: boolean;
  recentCartRetentionHours?: number;
  offlineModeEnabled?: boolean;
  syncIntervalSeconds?: number;
  deviceOfflineAfterSeconds?: number;
  defaultPaymentMethod?: PosChannelPaymentMethod;
  defaultPaymentMethodsEnabled?: PosChannelPaymentMethod[];
  defaultRoundingRule?: PosChannelRoundingRule;
  taxEnabled?: boolean;
  defaultTaxRate?: string;
  pricesIncludeTax?: boolean;
  taxRegistrationNumber?: string | null;
  defaultAutoPrintReceipt?: boolean;
  defaultPrintCopies?: number;
  defaultLockTimeoutSeconds?: number;
  version: number;
};

export type PosChannelCashTrackingSummary = {
  expectedCash: number;
  countedCash: number;
  variance: number;
};

export type PosChannelStaffSummary = {
  onDutyCount: number;
  onBreakCount: number;
  offDutyCount: number;
};

export type PosChannelOverview = {
  generatedAt: string;
  timezone: string;
  currency: string;
  filters: {
    from: string;
    to: string;
    branchId: string | null;
  };
  metrics: PosChannelOverviewMetrics;
  branches: PosChannelBranchPerformance[];
  recentSessions: PosChannelRegisterSession[];
  attentionDevices: PosChannelDeviceSummary[];
  availableBranches: PosChannelAvailableBranch[];
  availableCurrencies: string[];
  deviceSummary: PosChannelDeviceMetrics;
  cashTracking: PosChannelCashTrackingSummary;
  staffSummary: PosChannelStaffSummary;
};

export type PosChannelRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};
