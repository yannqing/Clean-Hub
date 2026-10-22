import { WebSocket } from "ws";

import {
  POS_REALTIME_PROTOCOL_VERSION,
  type PosTerminalServiceHealth,
  type TenantDeviceRealtimeState,
  type TenantRealtimeDeviceStateChanged,
} from "@cleanhub/domain/pos-terminal-status";
import { createId } from "@cleanhub/id";

import {
  REALTIME_HEARTBEAT_INTERVAL_MS,
  REALTIME_LEASE_REFRESH_INTERVAL_MS,
  REALTIME_MAX_BUFFERED_BYTES,
  REALTIME_MAX_CONNECTIONS,
  REALTIME_MAX_POS_CONNECTIONS_PER_TERMINAL,
  REALTIME_MAX_TENANT_CONNECTIONS,
  type PosRealtimeIdentity,
  type RealtimeConnection,
  type RealtimeHubOptions,
  type RealtimeHubHealth,
  type RealtimeIdentity,
  type RealtimeSocket,
} from "./realtime.types.js";

function terminalKey(
  identity: Pick<PosRealtimeIdentity, "tenantId" | "terminalId">,
) {
  return `${identity.tenantId}:${identity.terminalId}`;
}

function closeReason(value: string): string {
  return value.trim().slice(0, 64) || "connection_closed";
}

export class RealtimeHub {
  private readonly connections = new Map<string, RealtimeConnection>();
  private readonly posConnections = new Map<string, Set<string>>();
  private readonly posPresenceUpdates = new Map<string, Set<Promise<void>>>();
  private readonly tenantConnections = new Map<string, Set<string>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private started = false;
  private serviceHealth: PosTerminalServiceHealth = "unknown";
  private rejectedConnections = 0;
  private leaseRefreshFailures = 0;
  private leaseSweepFailures = 0;
  private leaseSweepPending = false;
  private lastLeaseSweepAt = 0;

  constructor(private readonly options: RealtimeHubOptions) {}

  start(): void {
    if (this.heartbeatTimer) return;
    this.started = true;
    this.heartbeatTimer = setInterval(() => {
      this.sweepConnections();
    }, REALTIME_HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
    this.runExpiredLeaseSweep(Date.now());
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.started = false;
    for (const connection of [...this.connections.values()]) {
      connection.socket.close(1012, "server_restarting");
      this.unregister(connection.identity.connectionId, "server_restarting");
    }
    await Promise.allSettled(
      [...this.posPresenceUpdates.values()].flatMap((updates) => [...updates]),
    );
  }

  markServiceHealthy(): void {
    this.serviceHealth = "healthy";
  }

  markServiceDegraded(): void {
    this.serviceHealth = "degraded";
  }

  getServiceHealth(): PosTerminalServiceHealth {
    return this.serviceHealth;
  }

  getHealth(): RealtimeHubHealth {
    return {
      started: this.started,
      serviceHealth: this.serviceHealth,
      activeConnections: this.connections.size,
      activePosTerminals: this.posConnections.size,
      activeTenantSubscribers: [...this.tenantConnections.values()].reduce(
        (total, connections) => total + connections.size,
        0,
      ),
      rejectedConnections: this.rejectedConnections,
      leaseRefreshFailures: this.leaseRefreshFailures,
      leaseSweepFailures: this.leaseSweepFailures,
    };
  }

  register(
    identity: RealtimeIdentity,
    socket: RealtimeSocket,
  ): RealtimeConnection | null {
    if (this.connections.size >= REALTIME_MAX_CONNECTIONS) {
      this.rejectedConnections += 1;
      socket.close(1013, "realtime_capacity_reached");
      return null;
    }
    if (
      identity.kind === "tenant" &&
      (this.tenantConnections.get(identity.tenantId)?.size ?? 0) >=
        REALTIME_MAX_TENANT_CONNECTIONS
    ) {
      this.rejectedConnections += 1;
      socket.close(1013, "tenant_realtime_capacity_reached");
      return null;
    }
    const now = Date.now();
    const connection: RealtimeConnection = {
      identity,
      socket,
      openedAt: now,
      lastPongAt: now,
      lastMessageAt: now,
      lastSequence: -1,
      lastLeaseRefreshAt: now,
      leaseRefreshPending: false,
      closed: false,
    };
    this.connections.set(identity.connectionId, connection);

    socket.raw?.on("pong", () => {
      const active = this.connections.get(identity.connectionId);
      if (active && !active.closed) active.lastPongAt = Date.now();
    });

    if (identity.kind === "pos") {
      const key = terminalKey(identity);
      const ids = this.posConnections.get(key) ?? new Set<string>();
      const wasOffline = ids.size === 0;
      ids.add(identity.connectionId);
      this.posConnections.set(key, ids);
      this.enforceTerminalConnectionLimit(key, ids);

      if (wasOffline) {
        const persistence = this.options
          .onFirstPosConnection(identity)
          .then((active) => {
            if (!active) socket.close(4403, "terminal_session_invalid");
          })
          .catch((error) => {
            this.options.logger.error(
              {
                err: error,
                tenantId: identity.tenantId,
                terminalId: identity.terminalId,
                connectionId: identity.connectionId,
              },
              "Failed to persist POS realtime connection",
            );
            socket.close(1011, "presence_persistence_failed");
          });
        this.trackPosPresenceUpdate(identity, persistence);
      }
    } else {
      const ids = this.tenantConnections.get(identity.tenantId) ?? new Set();
      ids.add(identity.connectionId);
      this.tenantConnections.set(identity.tenantId, ids);
    }

    return connection;
  }

  unregister(connectionId: string, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.closed) return;

    connection.closed = true;
    this.connections.delete(connectionId);
    const identity = connection.identity;

    if (identity.kind === "pos") {
      const key = terminalKey(identity);
      const ids = this.posConnections.get(key);
      ids?.delete(connectionId);
      if (!ids || ids.size === 0) {
        this.posConnections.delete(key);
        const pendingUpdates = [
          ...(this.posPresenceUpdates.get(key) ?? new Set<Promise<void>>()),
        ];
        const disconnection = Promise.allSettled(pendingUpdates).then(() =>
          this.options
            .onLastPosDisconnection(identity, closeReason(reason))
            .catch((error) => {
              this.options.logger.error(
                {
                  err: error,
                  tenantId: identity.tenantId,
                  terminalId: identity.terminalId,
                  connectionId,
                },
                "Failed to persist POS realtime disconnection",
              );
            }),
        );
        this.trackPosPresenceUpdate(identity, disconnection);
      }
      return;
    }

    const ids = this.tenantConnections.get(identity.tenantId);
    ids?.delete(connectionId);
    if (!ids || ids.size === 0) {
      this.tenantConnections.delete(identity.tenantId);
    }
  }

  acceptSequence(connectionId: string, sequence: number): boolean {
    const connection = this.connections.get(connectionId);
    if (
      !connection ||
      connection.closed ||
      sequence <= connection.lastSequence
    ) {
      return false;
    }

    connection.lastSequence = sequence;
    connection.lastMessageAt = Date.now();
    return true;
  }

  touch(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && !connection.closed) {
      connection.lastMessageAt = Date.now();
    }
  }

  send(connectionId: string, message: unknown): boolean {
    const connection = this.connections.get(connectionId);
    return connection ? this.sendToConnection(connection, message) : false;
  }

  broadcastDeviceState(
    tenantId: string,
    state: TenantDeviceRealtimeState,
  ): void {
    const message: TenantRealtimeDeviceStateChanged = {
      type: "tenant.device.status.changed",
      protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
      eventId: createId(),
      serverTime: new Date().toISOString(),
      state,
    };
    const ids = this.tenantConnections.get(tenantId);
    if (!ids) return;

    for (const id of ids) {
      const connection = this.connections.get(id);
      if (!connection || connection.identity.kind !== "tenant") continue;
      if (!connection.identity.branchIds.has(state.branchId)) continue;
      this.sendToConnection(connection, message);
    }
  }

  private sendToConnection(
    connection: RealtimeConnection,
    message: unknown,
  ): boolean {
    const raw = connection.socket.raw;
    if (
      connection.closed ||
      connection.socket.readyState !== WebSocket.OPEN ||
      (raw?.bufferedAmount ?? 0) > REALTIME_MAX_BUFFERED_BYTES
    ) {
      if ((raw?.bufferedAmount ?? 0) > REALTIME_MAX_BUFFERED_BYTES) {
        connection.socket.close(1013, "realtime_backpressure");
      }
      return false;
    }

    connection.socket.send(JSON.stringify(message), { compress: false });
    return true;
  }

  private enforceTerminalConnectionLimit(key: string, ids: Set<string>): void {
    if (ids.size <= REALTIME_MAX_POS_CONNECTIONS_PER_TERMINAL) return;

    const oldest = [...ids]
      .map((id) => this.connections.get(id))
      .filter((value): value is RealtimeConnection => Boolean(value))
      .sort((left, right) => left.openedAt - right.openedAt)[0];
    if (oldest) {
      oldest.socket.close(4009, "too_many_terminal_connections");
    }
  }

  private sweepConnections(): void {
    const now = Date.now();
    for (const connection of this.connections.values()) {
      if (connection.closed) continue;

      if (connection.identity.accessTokenExpiresAt <= now) {
        connection.socket.close(4401, "access_token_expired");
        continue;
      }

      if (now - connection.lastPongAt > REALTIME_HEARTBEAT_INTERVAL_MS * 3) {
        connection.socket.raw?.terminate();
        this.unregister(connection.identity.connectionId, "heartbeat_timeout");
        continue;
      }

      if (
        connection.identity.kind === "pos" &&
        this.isTerminalConnectionLeader(connection.identity) &&
        !connection.leaseRefreshPending &&
        now - connection.lastLeaseRefreshAt >=
          REALTIME_LEASE_REFRESH_INTERVAL_MS
      ) {
        const identity = connection.identity;
        connection.leaseRefreshPending = true;
        const persistence = this.options
          .onPosLeaseRefresh(identity)
          .then((active) => {
            if (!active) {
              connection.socket.close(4403, "terminal_session_invalid");
            }
          })
          .catch((error) => {
            this.leaseRefreshFailures += 1;
            this.markServiceDegraded();
            this.options.logger.error(
              {
                err: error,
                tenantId: identity.tenantId,
                terminalId: identity.terminalId,
                connectionId: identity.connectionId,
              },
              "Failed to refresh POS realtime lease",
            );
            this.send(identity.connectionId, {
              type: "realtime.error",
              protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
              code: "LEASE_REFRESH_FAILED",
              message: "Realtime lease could not be persisted.",
              retryable: true,
              serverTime: new Date().toISOString(),
            });
          })
          .finally(() => {
            connection.lastLeaseRefreshAt = Date.now();
            connection.leaseRefreshPending = false;
          });
        this.trackPosPresenceUpdate(identity, persistence);
      }

      try {
        connection.socket.raw?.ping();
      } catch (error) {
        this.options.logger.warn(
          {
            err: error,
            connectionId: connection.identity.connectionId,
            kind: connection.identity.kind,
          },
          "POS realtime ping failed",
        );
      }
    }

    if (
      !this.leaseSweepPending &&
      now - this.lastLeaseSweepAt >= REALTIME_LEASE_REFRESH_INTERVAL_MS
    ) {
      this.runExpiredLeaseSweep(now);
    }
  }

  private runExpiredLeaseSweep(now: number): void {
    this.leaseSweepPending = true;
    this.lastLeaseSweepAt = now;
    const activeTerminalIds = new Set<string>();
    for (const connection of this.connections.values()) {
      if (!connection.closed && connection.identity.kind === "pos") {
        activeTerminalIds.add(connection.identity.terminalId);
      }
    }

    void this.options
      .onExpiredPosLeaseSweep(activeTerminalIds)
      .then((expired) => {
        this.markServiceHealthy();
        for (const item of expired) {
          this.broadcastDeviceState(item.tenantId, item.state);
        }
      })
      .catch((error) => {
        this.leaseSweepFailures += 1;
        this.markServiceDegraded();
        this.options.logger.error(
          { err: error },
          "Failed to reconcile expired POS realtime leases",
        );
      })
      .finally(() => {
        this.leaseSweepPending = false;
      });
  }

  private isTerminalConnectionLeader(identity: PosRealtimeIdentity): boolean {
    const ids = this.posConnections.get(terminalKey(identity));
    return ids?.values().next().value === identity.connectionId;
  }

  private trackPosPresenceUpdate(
    identity: PosRealtimeIdentity,
    update: Promise<void>,
  ): void {
    const key = terminalKey(identity);
    const updates =
      this.posPresenceUpdates.get(key) ?? new Set<Promise<void>>();
    updates.add(update);
    this.posPresenceUpdates.set(key, updates);
    void update.finally(() => {
      updates.delete(update);
      if (updates.size === 0) this.posPresenceUpdates.delete(key);
    });
  }
}

export function createRealtimeConnectionId(): string {
  return createId();
}

export function parseAccessTokenExpiry(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}
