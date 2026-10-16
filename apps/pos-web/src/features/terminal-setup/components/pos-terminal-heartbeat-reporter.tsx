"use client";

import type { PosTerminalHeartbeatRequest } from "@cleanhub/api-client";
import { useCallback, useEffect, useRef } from "react";

import { useOfflineSync } from "@/features/offline/components";
import { posApi } from "@/lib/api-client";
import { isPosTerminalSessionInvalidated } from "@/lib/pos-terminal-session";

import { getPosTerminalRuntimeMetadata } from "../terminal-runtime";

const HEARTBEAT_INTERVAL_MS = 60_000;
const MAX_SYNC_ERROR_LENGTH = 2_000;

type PosTerminalHeartbeatReporterProps = {
  enabled: boolean;
};

function buildSyncHeartbeat(
  status: ReturnType<typeof useOfflineSync>["status"],
  error: string | null,
): Pick<
  PosTerminalHeartbeatRequest,
  "syncStatus" | "lastSyncedAt" | "lastSyncError"
> | null {
  if (status === "offline") {
    return null;
  }

  if (status === "synced") {
    return {
      syncStatus: "synced",
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: null,
    };
  }

  if (status === "pending" || status === "replaying") {
    return { syncStatus: "syncing" };
  }

  return {
    syncStatus: "error",
    lastSyncError:
      error?.slice(0, MAX_SYNC_ERROR_LENGTH) ||
      "POS offline synchronization failed.",
  };
}

/**
 * Keeps the tenant terminal list accurate without trusting caller-provided
 * terminal identity. The API derives that identity from the authenticated
 * terminal credential and only receives runtime/synchronization facts here.
 */
export function PosTerminalHeartbeatReporter({
  enabled,
}: PosTerminalHeartbeatReporterProps) {
  const { error, status } = useOfflineSync();
  const runtimeMetadataRef = useRef<ReturnType<
    typeof getPosTerminalRuntimeMetadata
  > | null>(null);
  const inFlightRef = useRef(false);

  const report = useCallback(async () => {
    if (
      !enabled ||
      typeof navigator === "undefined" ||
      !navigator.onLine ||
      isPosTerminalSessionInvalidated()
    ) {
      return;
    }

    const syncHeartbeat = buildSyncHeartbeat(status, error);
    if (!syncHeartbeat || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    try {
      runtimeMetadataRef.current ??= getPosTerminalRuntimeMetadata();
      const runtimeMetadata = await runtimeMetadataRef.current;
      await posApi.pos.terminalSettings.heartbeat({
        ...runtimeMetadata,
        ...syncHeartbeat,
      });
    } catch {
      // Heartbeats are best-effort. The next lifecycle event or interval will
      // retry, while auth failures are handled centrally by the API client.
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, error, status]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const initialHeartbeat = window.setTimeout(() => {
      void report();
    }, 0);
    const intervalId = window.setInterval(() => {
      void report();
    }, HEARTBEAT_INTERVAL_MS);
    const handleOnline = () => void report();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void report();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialHeartbeat);
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, report]);

  return null;
}
