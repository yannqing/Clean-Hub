"use client";

import {
  buildScopedOfflineQueueKey,
  createScopedOfflineQueue,
  recoverScopedOfflineQueue,
  type AsyncKeyValueStorage,
  type OfflineQueue,
  type OfflineQueueItem,
  type OfflineQueueScope,
  type ReplayHandler,
} from "@cleanhub/offline";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";
import { replayCurrentPosOfflineQueueItem } from "@/features/offline/lib/replay-pos-offline-queue-item";
import { summarizePosOfflineQueueItems } from "@/features/offline/lib/pos-offline-operations";
import {
  type PosTerminalHealthResult,
  verifyPosTerminalSession,
} from "@/features/terminal-setup/session-health";
import { posMessage } from "@/lib/pos-message";
import {
  isPosTerminalSessionInvalidated,
  POS_TERMINAL_SESSION_INVALIDATED_EVENT,
} from "@/lib/pos-terminal-session";

export type OfflineSyncStatus =
  | "synced"
  | "offline"
  | "pending"
  | "replaying"
  | "error";

type OfflineReplayHandlers = Map<string, ReplayHandler>;

type OfflineSyncContextValue = {
  queue: OfflineQueue | null;
  /** Browser connectivity plus a recent terminal-session health check. */
  isConnectionAvailable: boolean;
  /** False only while the first health check for this mounted POS is running. */
  connectionStatusResolved: boolean;
  status: OfflineSyncStatus;
  pendingCount: number;
  pendingSalesCount: number;
  oldestPendingAt: string | null;
  error: string | null;
  retry(): Promise<void>;
  refresh(): Promise<void>;
  registerReplayHandler(entity: string, handler: ReplayHandler): () => void;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Offline replay failed.";
}

function getQuarantineWarning(pendingCount: number): string | null {
  if (pendingCount === 0) {
    return null;
  }

  return posMessage("pos.inline.offlineScopeMismatch", {
    count: pendingCount,
  });
}

async function runWithOfflineReplayLock(
  queueKey: string,
  operation: () => Promise<void>,
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    await operation();
    return;
  }

  await navigator.locks.request(
    `cleanhub:offline-replay:${queueKey}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (lock) await operation();
    },
  );
}

type ScopedRuntimeQueue = {
  queue: OfflineQueue;
  queueKey: string;
  scope: OfflineQueueScope;
  storage: AsyncKeyValueStorage;
};

export function OfflineSyncProvider({
  tenantId,
  branchId,
  terminalId,
  userId,
  terminalCredentialVersion,
  children,
}: {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  userId?: string | null;
  terminalCredentialVersion?: number | null;
  children: React.ReactNode;
}) {
  const runtime = usePosRuntimeConfig();
  // Server Components cannot resolve the session while the API is unavailable.
  // The runtime provider then restores a short-lived, terminal-scoped snapshot
  // so this provider can still access the pre-existing durable queue.
  const resolvedTenantId = tenantId ?? runtime.tenantId;
  const resolvedBranchId = branchId ?? runtime.branchId;
  const resolvedTerminalId = terminalId ?? runtime.terminalId;
  const resolvedUserId = userId ?? runtime.userId;
  const resolvedTerminalCredentialVersion =
    terminalCredentialVersion ?? runtime.terminalCredentialVersion;
  const handlersRef = useRef<OfflineReplayHandlers>(new Map());
  const replayPromisesRef = useRef(new Map<string, Promise<void>>());
  const activeScopeKeyRef = useRef<string | null>(null);
  const [online, setOnline] = useState(true);
  const [connectionStatusResolved, setConnectionStatusResolved] =
    useState(false);
  const [currentPendingCount, setCurrentPendingCount] = useState(0);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [oldestPendingAt, setOldestPendingAt] = useState<string | null>(null);
  const [quarantinedPendingCount, setQuarantinedPendingCount] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quarantineWarning, setQuarantineWarning] = useState<string | null>(
    null,
  );

  const runtimeQueue = useMemo<ScopedRuntimeQueue | null>(() => {
    if (
      !resolvedTenantId ||
      !resolvedBranchId ||
      !resolvedTerminalId ||
      !resolvedUserId ||
      !resolvedTerminalCredentialVersion
    ) {
      return null;
    }

    const storage = getPosOfflineStorage();
    const scope: OfflineQueueScope = {
      tenantId: resolvedTenantId,
      branchId: resolvedBranchId,
      terminalId: resolvedTerminalId,
      userId: resolvedUserId,
      terminalCredentialVersion: resolvedTerminalCredentialVersion,
    };
    return {
      queue: createScopedOfflineQueue({ storage, scope }),
      queueKey: buildScopedOfflineQueueKey(scope),
      scope,
      storage,
    };
  }, [
    resolvedBranchId,
    resolvedTenantId,
    resolvedTerminalCredentialVersion,
    resolvedTerminalId,
    resolvedUserId,
  ]);
  const queue = runtimeQueue?.queue ?? null;
  const pendingCount = currentPendingCount + quarantinedPendingCount;
  const error = syncError ?? quarantineWarning;

  const refresh = useCallback(async () => {
    if (!runtimeQueue) {
      setCurrentPendingCount(0);
      setPendingSalesCount(0);
      setOldestPendingAt(null);
      setSyncError("The enrolled terminal scope is unavailable.");
      return;
    }

    try {
      const items = await runtimeQueue.queue.list();
      if (activeScopeKeyRef.current !== runtimeQueue.queueKey) {
        return;
      }
      setCurrentPendingCount(
        items.filter((item) => item.status === "pending").length,
      );
      const summary = summarizePosOfflineQueueItems(items);
      setPendingSalesCount(summary.pendingSalesCount);
      setOldestPendingAt(summary.oldestPendingAt);
      // A dead-lettered operation has stopped retrying, so its error must stay
      // on screen until an operator deals with it — surface those first.
      const failed =
        items.find((item) => item.status === "failed") ??
        items.find(
          (item) => item.status === "pending" && Boolean(item.lastError),
        );
      setSyncError(failed?.lastError ?? null);
    } catch (storageError) {
      if (activeScopeKeyRef.current === runtimeQueue.queueKey) {
        setSyncError(getErrorMessage(storageError));
      }
    }
  }, [runtimeQueue]);

  const recoverPreviousEpochs = useCallback(async () => {
    if (!runtimeQueue) {
      return;
    }

    const recovery = await recoverScopedOfflineQueue({
      storage: runtimeQueue.storage,
      scope: runtimeQueue.scope,
    });
    if (activeScopeKeyRef.current !== runtimeQueue.queueKey) {
      return;
    }

    setQuarantinedPendingCount(recovery.quarantinedItemCount);
    setQuarantineWarning(getQuarantineWarning(recovery.quarantinedItemCount));
  }, [runtimeQueue]);

  const replayQueue = useCallback(async () => {
    if (!runtimeQueue) {
      setSyncError("The enrolled terminal scope is unavailable.");
      return;
    }

    const existingReplay = replayPromisesRef.current.get(runtimeQueue.queueKey);
    if (existingReplay) {
      return existingReplay;
    }

    const replay = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (activeScopeKeyRef.current === runtimeQueue.queueKey) {
          setOnline(false);
        }
        return;
      }
      if (isPosTerminalSessionInvalidated()) {
        return;
      }

      const health = await verifyPosTerminalSession();
      if (
        health !== "ready" ||
        isPosTerminalSessionInvalidated() ||
        activeScopeKeyRef.current !== runtimeQueue.queueKey
      ) {
        return;
      }

      try {
        await recoverPreviousEpochs();
      } catch (recoveryError) {
        if (activeScopeKeyRef.current === runtimeQueue.queueKey) {
          setSyncError(getErrorMessage(recoveryError));
        }
        return;
      }
      if (
        isPosTerminalSessionInvalidated() ||
        activeScopeKeyRef.current !== runtimeQueue.queueKey
      ) {
        return;
      }

      setReplaying(true);
      setSyncError(null);
      try {
        const result = await runtimeQueue.queue.replayAvailable(
          async (item: OfflineQueueItem) => {
            if (
              isPosTerminalSessionInvalidated() ||
              activeScopeKeyRef.current !== runtimeQueue.queueKey
            ) {
              throw new Error(
                "The enrolled terminal session or offline queue scope is no longer active.",
              );
            }

            const handler = handlersRef.current.get(item.entity);
            if (handler) {
              await handler(item);
            } else {
              await replayCurrentPosOfflineQueueItem(item);
            }

            if (
              isPosTerminalSessionInvalidated() ||
              activeScopeKeyRef.current !== runtimeQueue.queueKey
            ) {
              throw new Error(
                "The enrolled terminal session or offline queue scope is no longer active.",
              );
            }
          },
        );
        if (
          result.failed.length > 0 &&
          activeScopeKeyRef.current === runtimeQueue.queueKey
        ) {
          setSyncError(
            result.failed[0]?.lastError ??
              posMessage("pos.inline.offlineRecordsFailed", {
                count: result.failed.length,
              }),
          );
        }
      } catch (replayError) {
        if (activeScopeKeyRef.current === runtimeQueue.queueKey) {
          setSyncError(getErrorMessage(replayError));
        }
      } finally {
        if (activeScopeKeyRef.current === runtimeQueue.queueKey) {
          setReplaying(false);
          await refresh();
        }
      }
    };

    const replayPromise = runWithOfflineReplayLock(
      runtimeQueue.queueKey,
      replay,
    ).finally(() => {
      if (
        replayPromisesRef.current.get(runtimeQueue.queueKey) === replayPromise
      ) {
        replayPromisesRef.current.delete(runtimeQueue.queueKey);
      }
    });
    replayPromisesRef.current.set(runtimeQueue.queueKey, replayPromise);
    return replayPromise;
  }, [recoverPreviousEpochs, refresh, runtimeQueue]);

  useEffect(() => {
    activeScopeKeyRef.current = runtimeQueue?.queueKey ?? null;

    const applyTerminalHealth = (health: PosTerminalHealthResult) => {
      setConnectionStatusResolved(true);
      setOnline(health === "ready");
      if (health === "ready") {
        void replayQueue();
      }
    };

    const initialRefresh = window.setTimeout(() => {
      setOnline(navigator.onLine);
      setConnectionStatusResolved(!navigator.onLine);
      setCurrentPendingCount(0);
      setPendingSalesCount(0);
      setOldestPendingAt(null);
      setQuarantinedPendingCount(0);
      setQuarantineWarning(null);
      setSyncError(null);
      setReplaying(false);
      void refresh().then(() => {
        if (!navigator.onLine) return;
        void verifyPosTerminalSession({ force: true }).then(applyTerminalHealth);
      });
    }, 0);

    const handleOnline = () => {
      setOnline(false);
      setConnectionStatusResolved(false);
      void verifyPosTerminalSession({ force: true }).then(applyTerminalHealth);
    };
    const handleOffline = () => {
      setOnline(false);
      setConnectionStatusResolved(true);
    };
    const handleTerminalInvalidated = () => {
      setReplaying(false);
      setSyncError("The enrolled terminal session is no longer active.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(
      POS_TERMINAL_SESSION_INVALIDATED_EVENT,
      handleTerminalInvalidated,
    );
    const healthInterval = window.setInterval(() => {
      if (!navigator.onLine) {
        handleOffline();
        return;
      }
      void verifyPosTerminalSession({ force: true }).then(applyTerminalHealth);
    }, 30_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(healthInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        POS_TERMINAL_SESSION_INVALIDATED_EVENT,
        handleTerminalInvalidated,
      );
    };
  }, [refresh, replayQueue, runtimeQueue?.queueKey]);

  const registerReplayHandler = useCallback(
    (entity: string, handler: ReplayHandler) => {
      handlersRef.current.set(entity, handler);
      return () => {
        if (handlersRef.current.get(entity) === handler) {
          handlersRef.current.delete(entity);
        }
      };
    },
    [],
  );

  const status: OfflineSyncStatus = replaying
    ? "replaying"
    : error
      ? "error"
      : !online
        ? "offline"
        : pendingCount > 0
          ? "pending"
          : "synced";

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      queue,
      isConnectionAvailable: online,
      connectionStatusResolved,
      status,
      pendingCount,
      pendingSalesCount,
      oldestPendingAt,
      error,
      retry: replayQueue,
      refresh,
      registerReplayHandler,
    }),
    [
      error,
      pendingCount,
      pendingSalesCount,
      oldestPendingAt,
      queue,
      refresh,
      registerReplayHandler,
      replayQueue,
      status,
      connectionStatusResolved,
      online,
    ],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncContextValue {
  const value = useContext(OfflineSyncContext);
  if (!value) {
    throw new Error("useOfflineSync must be used inside OfflineSyncProvider.");
  }
  return value;
}

export function useRegisterOfflineReplayHandler(
  entity: string,
  handler: ReplayHandler,
): void {
  const { registerReplayHandler } = useOfflineSync();
  useEffect(
    () => registerReplayHandler(entity, handler),
    [entity, handler, registerReplayHandler],
  );
}
