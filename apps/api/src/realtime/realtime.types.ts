import type { WSContext } from "hono/ws";
import type { WebSocket } from "ws";

import type { AppLogger } from "@cleanhub/logger";
import type {
  PosTerminalServiceHealth,
  TenantDeviceRealtimeState,
} from "@cleanhub/domain/pos-terminal-status";

import type { AuthContext } from "../modules/auth/auth.types.js";

export const REALTIME_HEARTBEAT_INTERVAL_MS = 15_000;
export const REALTIME_LEASE_DURATION_MS = 45_000;
export const REALTIME_LEASE_REFRESH_INTERVAL_MS = 30_000;
export const REALTIME_MAX_BUFFERED_BYTES = 1_048_576;
export const REALTIME_MAX_POS_CONNECTIONS_PER_TERMINAL = 3;
export const REALTIME_MAX_CONNECTIONS = 500;
export const REALTIME_MAX_TENANT_CONNECTIONS = 20;

export type RealtimeSocket = WSContext<WebSocket>;

export type PosRealtimeIdentity = {
  kind: "pos";
  connectionId: string;
  authContext: AuthContext;
  tenantId: string;
  branchId: string;
  terminalId: string;
  deviceId: string;
  credentialVersion: number;
  accessTokenExpiresAt: number;
};

export type TenantRealtimeIdentity = {
  kind: "tenant";
  connectionId: string;
  authContext: AuthContext;
  tenantId: string;
  branchIds: ReadonlySet<string>;
  accessTokenExpiresAt: number;
};

export type RealtimeIdentity = PosRealtimeIdentity | TenantRealtimeIdentity;

export type RealtimeConnection = {
  identity: RealtimeIdentity;
  socket: RealtimeSocket;
  openedAt: number;
  lastPongAt: number;
  lastMessageAt: number;
  lastSequence: number;
  lastLeaseRefreshAt: number;
  leaseRefreshPending: boolean;
  closed: boolean;
};

export type RealtimeHubOptions = {
  logger: AppLogger;
  onFirstPosConnection(identity: PosRealtimeIdentity): Promise<boolean>;
  onPosLeaseRefresh(identity: PosRealtimeIdentity): Promise<boolean>;
  onLastPosDisconnection(
    identity: PosRealtimeIdentity,
    reason: string,
  ): Promise<void>;
  onExpiredPosLeaseSweep(
    activeTerminalIds: ReadonlySet<string>,
  ): Promise<
    ReadonlyArray<{ tenantId: string; state: TenantDeviceRealtimeState }>
  >;
};

export type RealtimeHubHealth = {
  started: boolean;
  serviceHealth: PosTerminalServiceHealth;
  activeConnections: number;
  activePosTerminals: number;
  activeTenantSubscribers: number;
  rejectedConnections: number;
  leaseRefreshFailures: number;
  leaseSweepFailures: number;
};
