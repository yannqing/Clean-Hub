"use client";

import {
  derivePosTerminalOperationalStatus,
  POS_REALTIME_PROTOCOL_VERSION,
  type PosTerminalConnectionState,
  type PosTerminalOperationalStatus,
  type PosTerminalRealtimeClientMessage,
  type PosTerminalRealtimeServerMessage,
  type PosTerminalRuntimeSyncState,
  type PosTerminalServiceHealth,
} from "@cleanhub/domain/pos-terminal-status";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useOfflineSync } from "@/features/offline/components";
import { getPosTerminalRuntimeMetadata } from "@/features/terminal-setup/terminal-runtime";
import { getPosRealtimeUrl, posApi } from "@/lib/api-client";
import {
  invalidatePosTerminalSession,
  isPosTerminalSessionInvalidated,
} from "@/lib/pos-terminal-session";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const STATUS_REPORT_INTERVAL_MS = 30_000;
const HTTP_FALLBACK_INTERVAL_MS = 30_000;
const APPLICATION_ACK_TIMEOUT_MS = 45_000;
const OFFLINE_GRACE_MS = 8_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

type PosTerminalRealtimeContextValue = {
  operationalStatus: PosTerminalOperationalStatus;
  connectionState: PosTerminalConnectionState;
  serviceHealth: PosTerminalServiceHealth;
  syncState: PosTerminalRuntimeSyncState;
  pendingSalesCount: number;
  pendingOperationsCount: number;
  oldestPendingAt: string | null;
  lastAckAt: string | null;
  error: string | null;
  retry(): void;
};

const PosTerminalRealtimeContext =
  createContext<PosTerminalRealtimeContextValue | null>(null);

function toRuntimeSyncState(
  status: ReturnType<typeof useOfflineSync>["status"],
  pendingCount: number,
): PosTerminalRuntimeSyncState {
  if (status === "error") return "error";
  if (status === "replaying") return "syncing";
  if (status === "pending" || pendingCount > 0) return "pending";
  return "idle";
}

function parseServerMessage(
  value: string,
): PosTerminalRealtimeServerMessage | null {
  try {
    const parsed = JSON.parse(
      value,
    ) as Partial<PosTerminalRealtimeServerMessage>;
    if (
      parsed.protocolVersion !== POS_REALTIME_PROTOCOL_VERSION ||
      typeof parsed.type !== "string"
    ) {
      return null;
    }
    return parsed as PosTerminalRealtimeServerMessage;
  } catch {
    return null;
  }
}

function reconnectDelay(attempt: number): number {
  const base = Math.min(
    MAX_RECONNECT_DELAY_MS,
    [1_000, 2_000, 5_000, 10_000, 30_000][Math.min(attempt, 4)] ??
      MAX_RECONNECT_DELAY_MS,
  );
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export function PosTerminalRealtimeProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const offline = useOfflineSync();
  const syncState = toRuntimeSyncState(offline.status, offline.pendingCount);
  const [connectionState, setConnectionState] =
    useState<PosTerminalConnectionState>("unknown");
  const [serviceHealth, setServiceHealth] =
    useState<PosTerminalServiceHealth>("unknown");
  const [lastAckAt, setLastAckAt] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sequenceRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const lastAckEpochRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const offlineGraceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);
  const runtimeMetadataRef = useRef<ReturnType<
    typeof getPosTerminalRuntimeMetadata
  > | null>(null);
  const lastHttpFallbackSyncStateRef =
    useRef<PosTerminalRuntimeSyncState | null>(null);
  const reportFactsRef = useRef({
    syncState,
    pendingSalesCount: offline.pendingSalesCount,
    pendingOperationsCount: offline.pendingCount,
    oldestPendingAt: offline.oldestPendingAt,
    error: offline.error,
  });

  useEffect(() => {
    reportFactsRef.current = {
      syncState,
      pendingSalesCount: offline.pendingSalesCount,
      pendingOperationsCount: offline.pendingCount,
      oldestPendingAt: offline.oldestPendingAt,
      error: offline.error,
    };
  }, [
    offline.error,
    offline.oldestPendingAt,
    offline.pendingCount,
    offline.pendingSalesCount,
    syncState,
  ]);

  const clearTimer = useCallback(
    (timer: React.MutableRefObject<number | null>) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    },
    [],
  );

  const nextSequence = useCallback(() => {
    sequenceRef.current += 1;
    return sequenceRef.current;
  }, []);

  const send = useCallback((message: PosTerminalRealtimeClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const sendPing = useCallback(() => {
    send({
      type: "terminal.ping",
      protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
      sequence: nextSequence(),
      clientTime: new Date().toISOString(),
    });
  }, [nextSequence, send]);

  const sendStatusReport = useCallback(() => {
    const facts = reportFactsRef.current;
    send({
      type: "terminal.status.report",
      protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
      sequence: nextSequence(),
      clientTime: new Date().toISOString(),
      syncState: facts.syncState,
      pendingSalesCount: facts.pendingSalesCount,
      pendingOperationsCount: facts.pendingOperationsCount,
      oldestPendingAt: facts.oldestPendingAt,
      lastSyncErrorCode:
        facts.syncState === "error" ? "OFFLINE_SYNC_ERROR" : null,
      lastSyncErrorMessage:
        facts.syncState === "error"
          ? (facts.error?.slice(0, 2_000) ?? null)
          : null,
      appVisibility:
        typeof document === "undefined"
          ? "unknown"
          : document.visibilityState === "visible"
            ? "foreground"
            : "background",
    });
  }, [nextSequence, send]);

  const scheduleReconnect = useCallback(() => {
    if (
      !mountedRef.current ||
      !enabled ||
      isPosTerminalSessionInvalidated() ||
      reconnectTimerRef.current !== null ||
      !navigator.onLine
    ) {
      return;
    }
    const delay = reconnectDelay(reconnectAttemptRef.current);
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef.current();
    }, delay);
  }, [enabled]);

  useEffect(() => {
    connectRef.current = () => {
      if (
        !mountedRef.current ||
        !enabled ||
        isPosTerminalSessionInvalidated() ||
        socketRef.current?.readyState === WebSocket.OPEN ||
        socketRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      if (!navigator.onLine) {
        setConnectionState("disconnected");
        setServiceHealth("unavailable");
        return;
      }

      clearTimer(offlineGraceTimerRef);
      setConnectionState("connecting");
      setRealtimeError(null);
      lastAckEpochRef.current = 0;
      const socket = new WebSocket(getPosRealtimeUrl(), "cleanhub.pos.v1");
      socketRef.current = socket;
      const acknowledgementTimer = window.setTimeout(() => {
        socket.close(4008, "connection_ack_timeout");
      }, APPLICATION_ACK_TIMEOUT_MS);

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const message = parseServerMessage(event.data);
        if (!message) return;

        if (message.type === "connection.ack") {
          reconnectAttemptRef.current = 0;
          window.clearTimeout(acknowledgementTimer);
          lastAckEpochRef.current = Date.parse(message.serverTime);
          setConnectionState("connected");
          setServiceHealth(message.serviceHealth);
          setLastAckAt(message.serverTime);
          setRealtimeError(null);
          sendStatusReport();
          return;
        }

        if (
          message.type === "terminal.pong" ||
          message.type === "terminal.status.ack"
        ) {
          lastAckEpochRef.current = Date.parse(message.serverTime);
          setConnectionState("connected");
          setServiceHealth(message.serviceHealth);
          setLastAckAt(message.serverTime);
          setRealtimeError(null);
          return;
        }

        if (message.type === "realtime.error") {
          setRealtimeError(message.message);
          if (message.retryable) setServiceHealth("degraded");
        }
      };

      socket.onclose = (event) => {
        window.clearTimeout(acknowledgementTimer);
        if (socketRef.current === socket) socketRef.current = null;
        if (!mountedRef.current) return;

        if (event.code === 4403) {
          invalidatePosTerminalSession();
          return;
        }
        if (event.code === 4401) {
          setConnectionState("connecting");
          setServiceHealth("degraded");
          void posApi.auth
            .refresh()
            .then(() => scheduleReconnect())
            .catch(() => invalidatePosTerminalSession());
          return;
        }

        if (!navigator.onLine) {
          setConnectionState("disconnected");
          setServiceHealth("unavailable");
        } else {
          setConnectionState("connecting");
          setServiceHealth("degraded");
          clearTimer(offlineGraceTimerRef);
          offlineGraceTimerRef.current = window.setTimeout(() => {
            setConnectionState("disconnected");
            offlineGraceTimerRef.current = null;
          }, OFFLINE_GRACE_MS);
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        setServiceHealth("degraded");
        setRealtimeError("Realtime connection failed.");
      };
    };

    return () => {
      connectRef.current = () => undefined;
    };
  }, [clearTimer, enabled, scheduleReconnect, sendStatusReport]);

  useEffect(() => {
    mountedRef.current = true;
    const initialConnect = window.setTimeout(() => connectRef.current(), 0);
    const handleOnline = () => {
      clearTimer(reconnectTimerRef);
      connectRef.current();
    };
    const handleOffline = () => {
      clearTimer(reconnectTimerRef);
      clearTimer(offlineGraceTimerRef);
      setConnectionState("disconnected");
      setServiceHealth("unavailable");
      socketRef.current?.close(4001, "browser_offline");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") connectRef.current();
      sendStatusReport();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialConnect);
      clearTimer(reconnectTimerRef);
      clearTimer(offlineGraceTimerRef);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "component_unmounted");
    };
  }, [clearTimer, sendStatusReport]);

  useEffect(() => {
    const pingTimer = window.setInterval(() => {
      const socket = socketRef.current;
      if (
        socket?.readyState === WebSocket.OPEN &&
        lastAckEpochRef.current > 0 &&
        Date.now() - lastAckEpochRef.current > APPLICATION_ACK_TIMEOUT_MS
      ) {
        socket.close(4008, "application_ack_timeout");
        return;
      }
      sendPing();
    }, DEFAULT_HEARTBEAT_INTERVAL_MS);
    const reportTimer = window.setInterval(
      sendStatusReport,
      STATUS_REPORT_INTERVAL_MS,
    );
    return () => {
      window.clearInterval(pingTimer);
      window.clearInterval(reportTimer);
    };
  }, [sendPing, sendStatusReport]);

  useEffect(() => {
    sendStatusReport();
  }, [
    offline.error,
    offline.oldestPendingAt,
    offline.pendingCount,
    offline.pendingSalesCount,
    sendStatusReport,
    syncState,
  ]);

  useEffect(() => {
    const reportHttpFallback = async () => {
      if (
        !enabled ||
        !navigator.onLine ||
        socketRef.current?.readyState === WebSocket.OPEN ||
        isPosTerminalSessionInvalidated()
      ) {
        return;
      }

      try {
        runtimeMetadataRef.current ??= getPosTerminalRuntimeMetadata();
        const runtimeMetadata = await runtimeMetadataRef.current;
        const facts = reportFactsRef.current;
        const syncJustCompleted =
          facts.syncState === "idle" &&
          lastHttpFallbackSyncStateRef.current !== "idle";
        await posApi.pos.terminalSettings.heartbeat({
          ...runtimeMetadata,
          syncStatus:
            facts.syncState === "idle"
              ? "synced"
              : facts.syncState === "error"
                ? "error"
                : facts.syncState === "never"
                  ? "never"
                  : "syncing",
          lastSyncedAt: syncJustCompleted
            ? new Date().toISOString()
            : undefined,
          lastSyncError:
            facts.syncState === "error" ? facts.error?.slice(0, 2_000) : null,
          pendingSalesCount: facts.pendingSalesCount,
          pendingOperationsCount: facts.pendingOperationsCount,
          oldestPendingAt: facts.oldestPendingAt,
        });
        lastHttpFallbackSyncStateRef.current = facts.syncState;
        if (mountedRef.current) setServiceHealth("healthy");
      } catch {
        if (mountedRef.current) setServiceHealth("unavailable");
      }
    };

    const initialFallback = window.setTimeout(() => {
      void reportHttpFallback();
    }, 2_000);
    const fallbackTimer = window.setInterval(
      () => void reportHttpFallback(),
      HTTP_FALLBACK_INTERVAL_MS,
    );
    return () => {
      window.clearTimeout(initialFallback);
      window.clearInterval(fallbackTimer);
    };
  }, [enabled]);

  const operationalStatus = derivePosTerminalOperationalStatus({
    administrativeStatus: "active",
    connectionState,
    serviceHealth,
    syncState,
    pendingSalesCount: offline.pendingSalesCount,
    pendingOperationsCount: offline.pendingCount,
  });
  const value = useMemo<PosTerminalRealtimeContextValue>(
    () => ({
      operationalStatus,
      connectionState,
      serviceHealth,
      syncState,
      pendingSalesCount: offline.pendingSalesCount,
      pendingOperationsCount: offline.pendingCount,
      oldestPendingAt: offline.oldestPendingAt,
      lastAckAt,
      error: offline.error ?? realtimeError,
      retry: () => {
        void offline.retry();
        socketRef.current?.close(4000, "manual_reconnect");
        clearTimer(reconnectTimerRef);
        reconnectAttemptRef.current = 0;
        connectRef.current();
      },
    }),
    [
      clearTimer,
      connectionState,
      lastAckAt,
      offline,
      operationalStatus,
      realtimeError,
      serviceHealth,
      syncState,
    ],
  );

  return (
    <PosTerminalRealtimeContext.Provider value={value}>
      {children}
    </PosTerminalRealtimeContext.Provider>
  );
}

export function usePosTerminalRealtime(): PosTerminalRealtimeContextValue {
  const value = useContext(PosTerminalRealtimeContext);
  if (!value) {
    throw new Error(
      "usePosTerminalRealtime must be used inside PosTerminalRealtimeProvider.",
    );
  }
  return value;
}
