import assert from "node:assert/strict";

import { WebSocket } from "ws";

import {
  derivePosTerminalOperationalStatus,
  POS_REALTIME_PROTOCOL_VERSION,
} from "@cleanhub/domain/pos-terminal-status";
import type { AppLogger } from "@cleanhub/logger";

import { RealtimeHub } from "./realtime.hub.js";
import type {
  PosRealtimeIdentity,
  RealtimeSocket,
  TenantRealtimeIdentity,
} from "./realtime.types.js";
import {
  parseRealtimeJsonMessage,
  posRealtimeClientMessageSchema,
} from "./realtime.validation.js";

const baseFacts = {
  administrativeStatus: "active" as const,
  connectionState: "disconnected" as const,
  serviceHealth: "unavailable" as const,
  syncState: "idle" as const,
  pendingSalesCount: 0,
  pendingOperationsCount: 0,
  hasEverConnected: true,
};

assert.equal(
  derivePosTerminalOperationalStatus({
    ...baseFacts,
    administrativeStatus: "inactive",
    syncState: "error",
  }),
  "disabled",
  "administrative disablement must take precedence over runtime state",
);
assert.equal(
  derivePosTerminalOperationalStatus({ ...baseFacts, syncState: "error" }),
  "sync_error",
);
assert.equal(
  derivePosTerminalOperationalStatus({
    ...baseFacts,
    hasEverConnected: false,
  }),
  "never_seen",
);
assert.equal(
  derivePosTerminalOperationalStatus({
    ...baseFacts,
    connectionState: "connected",
    serviceHealth: "degraded",
  }),
  "degraded",
);
assert.equal(
  derivePosTerminalOperationalStatus({
    ...baseFacts,
    connectionState: "connected",
    serviceHealth: "healthy",
    pendingSalesCount: 2,
  }),
  "synchronizing",
);
assert.equal(
  derivePosTerminalOperationalStatus({
    ...baseFacts,
    pendingSalesCount: 2,
  }),
  "offline_pending",
);

const validPing = JSON.stringify({
  type: "terminal.ping",
  protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
  sequence: 1,
  clientTime: new Date().toISOString(),
});
assert.equal(
  posRealtimeClientMessageSchema.parse(parseRealtimeJsonMessage(validPing))
    .type,
  "terminal.ping",
);
assert.throws(() =>
  posRealtimeClientMessageSchema.parse({
    ...JSON.parse(validPing),
    protocolVersion: 999,
  }),
);
assert.throws(() => parseRealtimeJsonMessage("x".repeat(16_385)));

type MockSocket = {
  socket: RealtimeSocket;
  messages: string[];
  closes: Array<{ code?: number; reason?: string }>;
};

function createMockSocket(): MockSocket {
  const messages: string[] = [];
  const closes: Array<{ code?: number; reason?: string }> = [];
  const raw = {
    bufferedAmount: 0,
    on: () => raw,
    ping: () => undefined,
    terminate: () => undefined,
  };
  return {
    messages,
    closes,
    socket: {
      raw,
      readyState: WebSocket.OPEN,
      send: (value: string) => messages.push(value),
      close: (code?: number, reason?: string) => closes.push({ code, reason }),
    } as unknown as RealtimeSocket,
  };
}

const logger = {
  error: () => undefined,
  warn: () => undefined,
} as unknown as AppLogger;
let firstConnections = 0;
let lastDisconnections = 0;
const hub = new RealtimeHub({
  logger,
  onFirstPosConnection: async () => {
    firstConnections += 1;
    return true;
  },
  onPosLeaseRefresh: async () => true,
  onExpiredPosLeaseSweep: async () => [],
  onLastPosDisconnection: async () => {
    lastDisconnections += 1;
  },
});
const future = Date.now() + 60_000;
const posIdentity = {
  kind: "pos",
  connectionId: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
  tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FA2",
  branchId: "01ARZ3NDEKTSV4RRFFQ69G5FA3",
  terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FA4",
  deviceId: "terminal-device-1",
  credentialVersion: 1,
  accessTokenExpiresAt: future,
  authContext: {},
} as PosRealtimeIdentity;
const posSocket = createMockSocket();
hub.register(posIdentity, posSocket.socket);
await Promise.resolve();
assert.equal(firstConnections, 1);
assert.equal(hub.acceptSequence(posIdentity.connectionId, 1), true);
assert.equal(hub.acceptSequence(posIdentity.connectionId, 1), false);
assert.equal(hub.acceptSequence(posIdentity.connectionId, 0), false);

const allowedTenantSocket = createMockSocket();
const blockedTenantSocket = createMockSocket();
const tenantIdentity = {
  kind: "tenant",
  connectionId: "01ARZ3NDEKTSV4RRFFQ69G5FA5",
  tenantId: posIdentity.tenantId,
  branchIds: new Set([posIdentity.branchId]),
  accessTokenExpiresAt: future,
  authContext: {},
} as unknown as TenantRealtimeIdentity;
hub.register(tenantIdentity, allowedTenantSocket.socket);
hub.register(
  {
    ...tenantIdentity,
    connectionId: "01ARZ3NDEKTSV4RRFFQ69G5FA6",
    branchIds: new Set(["01ARZ3NDEKTSV4RRFFQ69G5FA7"]),
  },
  blockedTenantSocket.socket,
);
hub.broadcastDeviceState(posIdentity.tenantId, {
  terminalId: posIdentity.terminalId,
  branchId: posIdentity.branchId,
  administrativeStatus: "active",
  connectionState: "connected",
  serviceHealth: "healthy",
  syncState: "idle",
  operationalStatus: "online",
  pendingSalesCount: 0,
  pendingOperationsCount: 0,
  oldestPendingAt: null,
  lastSeenAt: new Date().toISOString(),
  lastRealtimeSeenAt: new Date().toISOString(),
  lastSyncedAt: null,
  lastSyncError: null,
  statusRevision: 1,
  observedAt: new Date().toISOString(),
});
assert.equal(allowedTenantSocket.messages.length, 1);
assert.equal(blockedTenantSocket.messages.length, 0);

hub.unregister(posIdentity.connectionId, "test_complete");
await new Promise((resolve) => setImmediate(resolve));
assert.equal(lastDisconnections, 1);

let resolvePresence!: (active: boolean) => void;
const delayedPresence = new Promise<boolean>((resolve) => {
  resolvePresence = resolve;
});
let delayedDisconnects = 0;
const raceHub = new RealtimeHub({
  logger,
  onFirstPosConnection: () => delayedPresence,
  onPosLeaseRefresh: async () => true,
  onExpiredPosLeaseSweep: async () => [],
  onLastPosDisconnection: async () => {
    delayedDisconnects += 1;
  },
});
const raceSocket = createMockSocket();
const raceIdentity = {
  ...posIdentity,
  connectionId: "01ARZ3NDEKTSV4RRFFQ69G5FA8",
};
raceHub.register(raceIdentity, raceSocket.socket);
raceHub.unregister(
  raceIdentity.connectionId,
  "disconnect_during_presence_write",
);
await Promise.resolve();
assert.equal(
  delayedDisconnects,
  0,
  "disconnect persistence must wait for an in-flight presence write",
);
resolvePresence(true);
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(delayedDisconnects, 1);

console.log("POS realtime protocol and hub smoke passed.");
