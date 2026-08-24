"use client";

import {
  POS_REALTIME_PROTOCOL_VERSION,
  type PosTerminalServiceHealth,
  type TenantRealtimeDeviceStateChanged,
  type TenantRealtimeServerMessage,
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

import { getTenantRealtimeUrl, webAdminApi } from "@/lib/api-client";

type TenantRealtimeConnectionState =
  | "unknown"
  | "connecting"
  | "connected"
  | "disconnected";

type DeviceEventHandler = (event: TenantRealtimeDeviceStateChanged) => void;

type TenantPosRealtimeContextValue = {
  connectionState: TenantRealtimeConnectionState;
  serviceHealth: PosTerminalServiceHealth;
  lastAckAt: string | null;
  lastEventAt: string | null;
  subscribe(handler: DeviceEventHandler): () => void;
  retry(): void;
};

const TenantPosRealtimeContext =
  createContext<TenantPosRealtimeContextValue | null>(null);

const HEARTBEAT_INTERVAL_MS = 15_000;
const ACK_TIMEOUT_MS = 45_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function parseServerMessage(value: string): TenantRealtimeServerMessage | null {
  try {
    const parsed = JSON.parse(value) as Partial<TenantRealtimeServerMessage>;
    if (
      parsed.protocolVersion !== POS_REALTIME_PROTOCOL_VERSION ||
      typeof parsed.type !== "string"
    ) {
      return null;
    }
    return parsed as TenantRealtimeServerMessage;
  } catch {
    return null;
  }
}

function reconnectDelay(attempt: number): number {
  const base =
    [1_000, 2_000, 5_000, 10_000, 30_000][Math.min(attempt, 4)] ??
    MAX_RECONNECT_DELAY_MS;
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

export function TenantPosRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connectionState, setConnectionState] =
    useState<TenantRealtimeConnectionState>("unknown");
  const [serviceHealth, setServiceHealth] =
    useState<PosTerminalServiceHealth>("unknown");
  const [lastAckAt, setLastAckAt] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef(new Set<DeviceEventHandler>());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);
  const lastAckEpochRef = useRef(0);
  const mountedRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (
      !mountedRef.current ||
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
  }, []);

  useEffect(() => {
    connectRef.current = () => {
      if (
        !mountedRef.current ||
        socketRef.current?.readyState === WebSocket.CONNECTING ||
        socketRef.current?.readyState === WebSocket.OPEN
      ) {
        return;
      }
      if (!navigator.onLine) {
        setConnectionState("disconnected");
        setServiceHealth("unavailable");
        return;
      }

      setConnectionState("connecting");
      lastAckEpochRef.current = 0;
      const socket = new WebSocket(
        getTenantRealtimeUrl(),
        "cleanhub.tenant.v1",
      );
      socketRef.current = socket;
      const acknowledgementTimer = window.setTimeout(() => {
        socket.close(4008, "connection_ack_timeout");
      }, ACK_TIMEOUT_MS);

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const message = parseServerMessage(event.data);
        if (!message) return;

        if (
          message.type === "connection.ack" ||
          message.type === "tenant.pong"
        ) {
          reconnectAttemptRef.current = 0;
          window.clearTimeout(acknowledgementTimer);
          lastAckEpochRef.current = Date.parse(message.serverTime);
          setLastAckAt(message.serverTime);
          setConnectionState("connected");
          setServiceHealth(message.serviceHealth);
          return;
        }

        if (message.type === "tenant.device.status.changed") {
          setLastEventAt(message.serverTime);
          for (const subscriber of subscribersRef.current) subscriber(message);
        }
      };

      socket.onclose = (event) => {
        window.clearTimeout(acknowledgementTimer);
        if (socketRef.current === socket) socketRef.current = null;
        if (!mountedRef.current) return;
        setConnectionState("disconnected");
        setServiceHealth(navigator.onLine ? "degraded" : "unavailable");
        if (event.code === 4401) {
          void webAdminApi.auth
            .refresh()
            .then(() => scheduleReconnect())
            .catch(() => undefined);
          return;
        }
        scheduleReconnect();
      };

      socket.onerror = () => {
        setConnectionState("disconnected");
        setServiceHealth("degraded");
      };
    };

    return () => {
      connectRef.current = () => undefined;
    };
  }, [scheduleReconnect]);

  const retry = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    socketRef.current?.close(4000, "manual_reconnect");
    connectRef.current();
  }, [clearReconnectTimer]);

  const subscribe = useCallback((handler: DeviceEventHandler) => {
    subscribersRef.current.add(handler);
    return () => subscribersRef.current.delete(handler);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialConnect = window.setTimeout(() => connectRef.current(), 0);
    const handleOnline = () => {
      clearReconnectTimer();
      connectRef.current();
    };
    const handleOffline = () => {
      clearReconnectTimer();
      setConnectionState("disconnected");
      setServiceHealth("unavailable");
      socketRef.current?.close(4001, "browser_offline");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") connectRef.current();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialConnect);
      clearReconnectTimer();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "component_unmounted");
    };
  }, [clearReconnectTimer]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        sequenceRef.current += 1;
        socket.send(
          JSON.stringify({
            type: "tenant.ping",
            protocolVersion: POS_REALTIME_PROTOCOL_VERSION,
            sequence: sequenceRef.current,
            clientTime: new Date().toISOString(),
          }),
        );
      }

      if (
        lastAckEpochRef.current > 0 &&
        Date.now() - lastAckEpochRef.current > ACK_TIMEOUT_MS
      ) {
        socket?.close(4008, "application_ack_timeout");
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(heartbeat);
  }, []);

  const value = useMemo<TenantPosRealtimeContextValue>(
    () => ({
      connectionState,
      serviceHealth,
      lastAckAt,
      lastEventAt,
      subscribe,
      retry,
    }),
    [connectionState, lastAckAt, lastEventAt, retry, serviceHealth, subscribe],
  );

  return (
    <TenantPosRealtimeContext.Provider value={value}>
      {children}
    </TenantPosRealtimeContext.Provider>
  );
}

export function useTenantPosRealtime(): TenantPosRealtimeContextValue {
  const value = useContext(TenantPosRealtimeContext);
  if (!value) {
    throw new Error(
      "useTenantPosRealtime must be used inside TenantPosRealtimeProvider.",
    );
  }
  return value;
}
