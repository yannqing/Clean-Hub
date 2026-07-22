"use client";

import {
  createScopedOfflineQueue,
  type OfflineQueue,
  type OfflineQueueItem,
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

export function OfflineSyncProvider({
  tenantId,
  branchId,
  terminalId,
  children,
}: {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  children: React.ReactNode;
}) {
  const handlersRef = useRef<OfflineReplayHandlers>(new Map());
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(() => {
    if (!tenantId || !branchId || !terminalId) return null;
    return createScopedOfflineQueue({
      storage: getPosOfflineStorage(),
      scope: { tenantId, branchId, terminalId },
    });
  }, [branchId, tenantId, terminalId]);

  const refresh = useCallback(async () => {
    if (!queue) {
      setPendingCount(0);
      setError("The enrolled terminal scope is unavailable.");
      return;
    }

    try {
      const items = await queue.list();
      setPendingCount(items.filter((item) => item.status === "pending").length);
      const failed = items.find(
        (item) => item.status === "pending" && Boolean(item.lastError),
      );
      setError(failed?.lastError ?? null);
    } catch (storageError) {
      setError(getErrorMessage(storageError));
    }
  }, [queue]);

  const replayQueue = useCallback(async () => {
    if (!queue) {
      setError("The enrolled terminal scope is unavailable.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOnline(false);
      return;
    }

    setReplaying(true);
    setError(null);
    try {
      const result = await queue.replay(async (item: OfflineQueueItem) => {
        const handler = handlersRef.current.get(item.entity);
        if (handler) {
          await handler(item);
          return;
        }
        await replayCurrentPosOfflineQueueItem(item);
      });
      if (result.failed) setError(result.failed.lastError ?? "Replay failed.");
    } catch (replayError) {
      setError(getErrorMessage(replayError));
    } finally {
      setReplaying(false);
      await refresh();
    }
  }, [queue, refresh]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refresh();
      if (navigator.onLine) void replayQueue();
    }, 0);

    const handleOnline = () => {
      setOnline(true);
      void replayQueue();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refresh, replayQueue]);

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
    [error, pendingCount, queue, refresh, registerReplayHandler, replayQueue, status],
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
