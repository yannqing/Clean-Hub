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

import { getPosOfflineStorage } from "@/features/hardware/lib/desktop-bridge";
import { replayCurrentPosOfflineQueueItem } from "@/features/offline/lib/replay-pos-offline-queue-item";
import { verifyPosTerminalSession } from "@/features/terminal-setup/session-health";
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
  status: OfflineSyncStatus;
  pendingCount: number;
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

  return `检测到 ${pendingCount} 条待同步记录属于其他门店、其他用户或不同的终端凭证版本。为避免数据错归，系统已将其隔离且不会自动重放，请联系管理员处理。`;
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
  const handlersRef = useRef<OfflineReplayHandlers>(new Map());
  const replayPromisesRef = useRef(new Map<string, Promise<void>>());
  const activeScopeKeyRef = useRef<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [currentPendingCount, setCurrentPendingCount] = useState(0);
  const [quarantinedPendingCount, setQuarantinedPendingCount] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quarantineWarning, setQuarantineWarning] = useState<string | null>(
    null,
  );

  const runtimeQueue = useMemo<ScopedRuntimeQueue | null>(() => {
    if (
      !tenantId ||
      !branchId ||
      !terminalId ||
      !userId ||
      !terminalCredentialVersion
    ) {
      return null;
    }

    const storage = getPosOfflineStorage();
    const scope: OfflineQueueScope = {
      tenantId,
      branchId,
      terminalId,
      userId,
      terminalCredentialVersion,
    };
    return {
      queue: createScopedOfflineQueue({ storage, scope }),
      queueKey: buildScopedOfflineQueueKey(scope),
      scope,
      storage,
    };
  }, [branchId, tenantId, terminalCredentialVersion, terminalId, userId]);
  const queue = runtimeQueue?.queue ?? null;
  const pendingCount = currentPendingCount + quarantinedPendingCount;
  const error = syncError ?? quarantineWarning;

  const refresh = useCallback(async () => {
    if (!runtimeQueue) {
      setCurrentPendingCount(0);
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
      const failed = items.find(
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
              `${result.failed.length} 条记录同步失败。`,
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

    const replayPromise = replay().finally(() => {
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

    const initialRefresh = window.setTimeout(() => {
      setCurrentPendingCount(0);
      setQuarantinedPendingCount(0);
      setQuarantineWarning(null);
      setSyncError(null);
      setReplaying(false);
      void refresh().then(() => {
        if (navigator.onLine) {
          return replayQueue();
        }
      });
    }, 0);

    const handleOnline = () => {
      setOnline(true);
      void verifyPosTerminalSession({ force: true }).then((health) => {
        if (health === "ready") {
          void replayQueue();
        }
      });
    };
    const handleOffline = () => setOnline(false);
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
    return () => {
      window.clearTimeout(initialRefresh);
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
      status,
      pendingCount,
      error,
      retry: replayQueue,
      refresh,
      registerReplayHandler,
    }),
    [
      error,
      pendingCount,
      queue,
      refresh,
      registerReplayHandler,
      replayQueue,
      status,
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
