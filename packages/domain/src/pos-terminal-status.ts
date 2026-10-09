export const POS_REALTIME_PROTOCOL_VERSION = 1 as const;

export const posTerminalConnectionStates = [
  "unknown",
  "connecting",
  "connected",
  "disconnected",
] as const;

export type PosTerminalConnectionState =
  (typeof posTerminalConnectionStates)[number];

export const posTerminalServiceHealthStates = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
] as const;

export type PosTerminalServiceHealth =
  (typeof posTerminalServiceHealthStates)[number];

export const posTerminalRuntimeSyncStates = [
  "never",
  "idle",
  "pending",
  "syncing",
  "error",
] as const;

export type PosTerminalRuntimeSyncState =
  (typeof posTerminalRuntimeSyncStates)[number];

export const posTerminalOperationalStatuses = [
  "unknown",
  "connecting",
  "online",
  "degraded",
  "synchronizing",
  "offline_pending",
  "offline",
  "sync_error",
  "disabled",
  "never_seen",
] as const;

export type PosTerminalOperationalStatus =
  (typeof posTerminalOperationalStatuses)[number];

export type PosTerminalStatusTone =
  | "neutral"
  | "success"
  | "info"
  | "warning"
  | "danger";

export type PosTerminalStatusFacts = {
  administrativeStatus: "active" | "inactive";
  connectionState: PosTerminalConnectionState;
  serviceHealth: PosTerminalServiceHealth;
  syncState: PosTerminalRuntimeSyncState;
  pendingSalesCount: number | null;
  pendingOperationsCount: number | null;
  hasEverConnected?: boolean;
};

function hasPendingWork(input: PosTerminalStatusFacts): boolean {
  return (
    (input.pendingSalesCount ?? 0) > 0 ||
    (input.pendingOperationsCount ?? 0) > 0 ||
    input.syncState === "pending"
  );
}

/**
 * Canonical POS terminal state reducer shared by POS, tenant administration,
 * and API responses. Transport and synchronization facts remain separate so
 * a broken realtime channel never changes order-write semantics.
 */
export function derivePosTerminalOperationalStatus(
  input: PosTerminalStatusFacts,
): PosTerminalOperationalStatus {
  if (input.administrativeStatus === "inactive") {
    return "disabled";
  }

  if (input.syncState === "error") {
    return "sync_error";
  }

  if (
    input.hasEverConnected === false &&
    input.connectionState !== "connected" &&
    input.connectionState !== "connecting"
  ) {
    return "never_seen";
  }

  const pending = hasPendingWork(input);

  if (input.connectionState === "connected") {
    if (
      input.serviceHealth === "degraded" ||
      input.serviceHealth === "unavailable" ||
      input.serviceHealth === "unknown"
    ) {
      return "degraded";
    }

    if (input.syncState === "syncing" || pending) {
      return "synchronizing";
    }

    return "online";
  }

  if (input.connectionState === "disconnected") {
    if (input.serviceHealth === "healthy") {
      return "degraded";
    }

    return pending ? "offline_pending" : "offline";
  }

  if (input.connectionState === "connecting") {
    return "connecting";
  }

  return "unknown";
}

export function getPosTerminalStatusTone(
  status: PosTerminalOperationalStatus,
): PosTerminalStatusTone {
  switch (status) {
    case "online":
      return "success";
    case "connecting":
    case "synchronizing":
      return "info";
    case "degraded":
    case "offline_pending":
      return "warning";
    case "sync_error":
      return "danger";
    default:
      return "neutral";
  }
}

export type PosTerminalAppVisibility =
  | "foreground"
  | "background"
  | "unknown";

export type PosTerminalRealtimeStatusReport = {
  type: "terminal.status.report";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  sequence: number;
  clientTime: string;
  syncState: PosTerminalRuntimeSyncState;
  pendingSalesCount: number;
  pendingOperationsCount: number;
  oldestPendingAt: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorMessage: string | null;
  appVisibility: PosTerminalAppVisibility;
};

export type PosTerminalRealtimePing = {
  type: "terminal.ping";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  sequence: number;
  clientTime: string;
};

export type PosTerminalRealtimeClientMessage =
  | PosTerminalRealtimeStatusReport
  | PosTerminalRealtimePing;

export type PosRealtimeConnectionAck = {
  type: "connection.ack";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  connectionId: string;
  serverTime: string;
  heartbeatIntervalMs: number;
  leaseDurationMs: number;
  serviceHealth: PosTerminalServiceHealth;
  terminalId?: string;
};

export type PosRealtimeStatusAck = {
  type: "terminal.status.ack";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  connectionId: string;
  sequence: number;
  statusRevision: number;
  serverTime: string;
  serviceHealth: PosTerminalServiceHealth;
};

export type PosRealtimePong = {
  type: "terminal.pong";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  connectionId: string;
  sequence: number;
  serverTime: string;
  serviceHealth: PosTerminalServiceHealth;
};

export type PosRealtimeErrorMessage = {
  type: "realtime.error";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  code: string;
  message: string;
  retryable: boolean;
  serverTime: string;
};

export type PosTerminalRealtimeServerMessage =
  | PosRealtimeConnectionAck
  | PosRealtimeStatusAck
  | PosRealtimePong
  | PosRealtimeErrorMessage;

export type TenantDeviceRealtimeState = {
  terminalId: string;
  branchId: string;
  administrativeStatus: "active" | "inactive";
  connectionState: PosTerminalConnectionState;
  serviceHealth: PosTerminalServiceHealth;
  syncState: PosTerminalRuntimeSyncState;
  operationalStatus: PosTerminalOperationalStatus;
  pendingSalesCount: number | null;
  pendingOperationsCount: number | null;
  oldestPendingAt: string | null;
  lastSeenAt: string | null;
  lastRealtimeSeenAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  statusRevision: number;
  observedAt: string;
};

export type TenantRealtimeDeviceStateChanged = {
  type: "tenant.device.status.changed";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  eventId: string;
  serverTime: string;
  state: TenantDeviceRealtimeState;
};

export type TenantRealtimePing = {
  type: "tenant.ping";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  sequence: number;
  clientTime: string;
};

export type TenantRealtimePong = {
  type: "tenant.pong";
  protocolVersion: typeof POS_REALTIME_PROTOCOL_VERSION;
  connectionId: string;
  sequence: number;
  serverTime: string;
  serviceHealth: PosTerminalServiceHealth;
};

export type TenantRealtimeServerMessage =
  | PosRealtimeConnectionAck
  | TenantRealtimeDeviceStateChanged
  | TenantRealtimePong
  | PosRealtimeErrorMessage;
