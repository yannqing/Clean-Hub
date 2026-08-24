import { createId } from "@cleanhub/id";

export type OfflineOperation = "create" | "update" | "delete";
export type OfflineQueueItemStatus = "pending" | "synced";

export type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
  keys?(): Promise<string[]>;
};

export type PreferencesLikeStorage = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove?(options: { key: string }): Promise<void>;
  keys?(): Promise<{ keys: string[] }>;
};

export type OfflineQueueItem<TPayload = unknown> = {
  id: string;
  /** Monotonic sequence within one scoped queue, used for ordered replay. */
  sequence: number;
  entity: string;
  operation: OfflineOperation;
  payload: TPayload;
  idempotencyKey: string;
  status: OfflineQueueItemStatus;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  lastError?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Optional queue metadata understood by dependency-aware replay. Operation IDs
 * refer to OfflineQueueItem.id values in the same scoped queue.
 */
export type OfflineQueueDependencyMetadata = Record<string, unknown> & {
  dependsOnOperationIds?: string[];
};

export type SyncQueueItem<TPayload = unknown> = OfflineQueueItem<TPayload>;

export type EnqueueInput<TPayload = unknown> = {
  entity: string;
  operation: OfflineOperation;
  payload: TPayload;
  id?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type ReplayHandler<TPayload = unknown> = (
  item: OfflineQueueItem<TPayload>,
) => Promise<void>;

export type ReplayResult<TPayload = unknown> = {
  replayed: OfflineQueueItem<TPayload>[];
  failed?: OfflineQueueItem<TPayload>;
};

export type ReplayBlockedReason = "dependency_failed" | "dependency_pending";

export type ReplayBlockedItem<TPayload = unknown> = {
  item: OfflineQueueItem<TPayload>;
  reason: ReplayBlockedReason;
  /** Every valid dependency declared by the blocked operation. */
  dependencyOperationIds: string[];
  /** Direct dependencies that are still present in the pending queue. */
  blockingOperationIds: string[];
  /** Failed operations found anywhere in the blocked dependency chain. */
  failedDependencyOperationIds: string[];
};

export type ReplayAvailableResult<TPayload = unknown> = {
  replayed: OfflineQueueItem<TPayload>[];
  failed: OfflineQueueItem<TPayload>[];
  blocked: ReplayBlockedItem<TPayload>[];
};

export type OfflineQueuePayloadUpdater<TPayload = unknown> = (
  payload: TPayload,
) => TPayload;

export type DeliveryTaskSummary = {
  id: string;
  tenantId?: string;
  branchId?: string;
  assigneeId?: string;
  status?: string;
  scheduledAt?: string;
  updatedAt?: string;
  customer?: {
    id?: string;
    name?: string;
    phone?: string;
  };
  address?: unknown;
  order?: unknown;
  ticket?: unknown;
  [key: string]: unknown;
};

export type DeliveryTaskDetail = DeliveryTaskSummary & {
  proofs?: unknown[];
  events?: unknown[];
};

export type DeliveryTaskCacheSnapshot<
  TTask extends DeliveryTaskSummary = DeliveryTaskSummary,
  TDetail extends DeliveryTaskDetail = DeliveryTaskDetail,
> = {
  loadedAt: string;
  tasks: TTask[];
  details: Record<string, TDetail>;
};

export type OfflineQueueOptions = {
  storage: AsyncKeyValueStorage;
  queueKey?: string;
};

export type OfflineQueueScope = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string;
  terminalCredentialVersion: number;
};

/**
 * The physical print spool belongs to a terminal, not to one staff session.
 * Keeping this key stable across PIN users and credential epoch changes
 * preserves exactly-once/reprint history after logout, rotation, or unlock.
 */
export type PersistentPrintJobQueueScope = Pick<
  OfflineQueueScope,
  "tenantId" | "branchId" | "terminalId"
>;

export type ParsedScopedOfflineQueueKey = {
  queueKey: string;
  namespace: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  userId: string | null;
  terminalCredentialVersion: number;
};

export type ScopedOfflineQueueQuarantineReason =
  | "branch_mismatch"
  | "user_mismatch"
  | "credential_epoch_mismatch"
  | "legacy_scope_unattributed"
  | "future_epoch"
  | "non_previous_epoch";

export type ScopedOfflineQueueQuarantine = {
  queueKey: string;
  scope: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    userId: string | null;
    terminalCredentialVersion: number | null;
  };
  pendingCount: number;
  reasons: ScopedOfflineQueueQuarantineReason[];
};

export type ScopedOfflineQueueRecoveryResult = {
  storageEnumerationSupported: boolean;
  migratedItemCount: number;
  migratedQueueKeys: string[];
  quarantinedItemCount: number;
  quarantined: ScopedOfflineQueueQuarantine[];
};

export type PersistentPrintJobStatus =
  | "pending"
  | "printing"
  | "printed"
  | "failed";

export type PersistentPrintJob<TPayload = unknown> = {
  id: string;
  idempotencyKey: string;
  payload: TPayload;
  status: PersistentPrintJobStatus;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
  lastError?: string;
};

export type EnqueuePrintJobInput<TPayload> = {
  payload: TPayload;
  id?: string;
  idempotencyKey?: string;
};

export type PrintJobHandler<TPayload> = (
  job: PersistentPrintJob<TPayload>,
) => Promise<void>;

export type PrintJobReplayResult<TPayload> = {
  printed: PersistentPrintJob<TPayload>[];
  failed?: PersistentPrintJob<TPayload>;
};

export type PersistentPrintJobPayloadUpdater<TPayload> = (
  payload: TPayload,
) => TPayload;

export type DeliveryTaskCacheOptions = {
  storage: AsyncKeyValueStorage;
  cacheKey?: string;
};

const DEFAULT_QUEUE_KEY = "cleanhub.offline.queue.v1";
const DEFAULT_PRINT_QUEUE_KEY = "cleanhub.pos.offline.print.queue.v1";
const DEFAULT_DELIVERY_TASK_CACHE_KEY = "cleanhub.offline.deliveryTasks.v1";
const DEFAULT_SCOPED_OFFLINE_QUEUE_NAMESPACE = "cleanhub.pos.offline.queue.v2";
const LEGACY_SCOPED_OFFLINE_QUEUE_NAMESPACE = "cleanhub.pos.offline.queue.v1";

class KeyedAsyncMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async runExclusive<TResult>(
    key: string,
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(
      () => gate,
      () => gate,
    );

    this.tails.set(key, tail);
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      release();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }

  async runExclusiveMany<TResult>(
    keys: string[],
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const uniqueKeys = [...new Set(keys)].sort();

    const acquire = (index: number): Promise<TResult> => {
      const key = uniqueKeys[index];
      if (!key) {
        return operation();
      }

      return this.runExclusive(key, () => acquire(index + 1));
    };

    return acquire(0);
  }
}

// Queue instances are frequently recreated by React. These module-level locks
// keep read-modify-write operations and replay execution mutually exclusive for
// every instance that targets the same persisted key in this JavaScript realm.
const queueStateMutex = new KeyedAsyncMutex();
const queueReplayMutex = new KeyedAsyncMutex();

type QueueLockKind = "replay" | "state";

function hashQueueLockKey(value: string): string {
  // Two differently-seeded 32-bit FNV-style lanes keep Web Lock names short
  // without exposing tenant/user identifiers. A collision only serializes two
  // unrelated queues; it cannot weaken isolation or corrupt their contents.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function browserQueueLockName(kind: QueueLockKind, key: string): string {
  return `cleanhub-pos-offline-${kind}-${hashQueueLockKey(key)}`;
}

async function runWithBrowserLock<TResult>(
  kind: QueueLockKind,
  key: string,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const lockManager =
    typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!lockManager) {
    return operation();
  }

  return lockManager.request(browserQueueLockName(kind, key), operation);
}

async function runWithBrowserLocks<TResult>(
  kind: QueueLockKind,
  keys: string[],
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const uniqueKeys = [...new Set(keys)].sort();

  const acquire = (index: number): Promise<TResult> => {
    const key = uniqueKeys[index];
    if (!key) {
      return operation();
    }

    return runWithBrowserLock(kind, key, () => acquire(index + 1));
  };

  return acquire(0);
}

function runQueueStateExclusive<TResult>(
  key: string,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  return queueStateMutex.runExclusive(key, () =>
    runWithBrowserLock("state", key, operation),
  );
}

function runQueueStateExclusiveMany<TResult>(
  keys: string[],
  operation: () => Promise<TResult>,
): Promise<TResult> {
  return queueStateMutex.runExclusiveMany(keys, () =>
    runWithBrowserLocks("state", keys, operation),
  );
}

function runQueueReplayExclusive<TResult>(
  key: string,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  return queueReplayMutex.runExclusive(key, () =>
    runWithBrowserLock("replay", key, operation),
  );
}

function runQueueReplayExclusiveMany<TResult>(
  keys: string[],
  operation: () => Promise<TResult>,
): Promise<TResult> {
  return queueReplayMutex.runExclusiveMany(keys, () =>
    runWithBrowserLocks("replay", keys, operation),
  );
}

export function createPreferencesStorageAdapter(
  preferences: PreferencesLikeStorage,
): AsyncKeyValueStorage {
  const adapter: AsyncKeyValueStorage = {
    async getItem(key) {
      const result = await preferences.get({ key });
      return result.value;
    },
    async setItem(key, value) {
      await preferences.set({ key, value });
    },
  };

  if (preferences.remove) {
    adapter.removeItem = async (key) => {
      await preferences.remove?.({ key });
    };
  }
  if (preferences.keys) {
    adapter.keys = async () => {
      const result = await preferences.keys?.();
      return result?.keys ?? [];
    };
  }

  return adapter;
}

export function createMemoryStorage(
  initial?: Record<string, string>,
): AsyncKeyValueStorage {
  const values = new Map(Object.entries(initial ?? {}));

  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    async keys() {
      return [...values.keys()];
    },
  };
}

export function createWebStorageAdapter(
  storage: Storage,
): AsyncKeyValueStorage {
  return {
    async getItem(key) {
      return storage.getItem(key);
    },
    async setItem(key, value) {
      storage.setItem(key, value);
    },
    async removeItem(key) {
      storage.removeItem(key);
    },
    async keys() {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    },
  };
}

export function buildScopedOfflineQueueKey(
  scope: OfflineQueueScope,
  namespace = DEFAULT_SCOPED_OFFLINE_QUEUE_NAMESPACE,
): string {
  const segments = [
    scope.tenantId,
    scope.branchId,
    scope.terminalId,
    scope.userId,
  ].map((segment) => segment.trim());

  if (
    segments.some((segment) => segment.length === 0) ||
    !Number.isInteger(scope.terminalCredentialVersion) ||
    scope.terminalCredentialVersion < 1
  ) {
    throw new Error(
      "Offline queue scope requires tenant, branch, terminal, user, and credential epoch identifiers.",
    );
  }

  return [
    namespace,
    ...segments.map(encodeURIComponent),
    `epoch-${scope.terminalCredentialVersion}`,
  ].join(":");
}

function buildLegacyScopedOfflineQueueKey(
  scope: Pick<OfflineQueueScope, "tenantId" | "branchId" | "terminalId">,
): string {
  const segments = [scope.tenantId, scope.branchId, scope.terminalId].map(
    (segment) => segment.trim(),
  );
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(
      "Legacy offline queue scope requires tenant, branch, and terminal identifiers.",
    );
  }

  return [
    LEGACY_SCOPED_OFFLINE_QUEUE_NAMESPACE,
    ...segments.map(encodeURIComponent),
  ].join(":");
}

export function parseScopedOfflineQueueKey(
  queueKey: string,
  namespace = DEFAULT_SCOPED_OFFLINE_QUEUE_NAMESPACE,
): ParsedScopedOfflineQueueKey | null {
  const prefix = `${namespace}:`;
  if (!queueKey.startsWith(prefix)) {
    return null;
  }

  const segments = queueKey.slice(prefix.length).split(":");
  if (segments.length !== 4 && segments.length !== 5) {
    return null;
  }

  const epochSegment = segments.at(-1);
  const epochMatch = /^epoch-([1-9]\d*)$/.exec(epochSegment ?? "");
  if (!epochMatch) {
    return null;
  }

  try {
    const tenantId = decodeURIComponent(segments[0] ?? "");
    const branchId = decodeURIComponent(segments[1] ?? "");
    const terminalId = decodeURIComponent(segments[2] ?? "");
    const userId =
      segments.length === 5 ? decodeURIComponent(segments[3] ?? "") : null;
    const terminalCredentialVersion = Number(epochMatch[1]);

    if (
      !tenantId ||
      !branchId ||
      !terminalId ||
      userId === "" ||
      !Number.isSafeInteger(terminalCredentialVersion)
    ) {
      return null;
    }

    return {
      queueKey,
      namespace,
      tenantId,
      branchId,
      terminalId,
      userId,
      terminalCredentialVersion,
    };
  } catch {
    return null;
  }
}

export function createScopedOfflineQueue(input: {
  storage: AsyncKeyValueStorage;
  scope: OfflineQueueScope;
  namespace?: string;
}): OfflineQueue {
  return new OfflineQueue({
    storage: input.storage,
    queueKey: buildScopedOfflineQueueKey(input.scope, input.namespace),
  });
}

export function buildScopedPrintJobQueueKey(
  scope: PersistentPrintJobQueueScope,
  namespace = DEFAULT_PRINT_QUEUE_KEY,
): string {
  const segments = [scope.tenantId, scope.branchId, scope.terminalId].map(
    (segment) => segment.trim(),
  );

  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(
      "Print job queue scope requires tenant, branch, and terminal identifiers.",
    );
  }

  return [namespace, ...segments.map(encodeURIComponent)].join(":");
}

export async function recoverScopedOfflineQueue(input: {
  storage: AsyncKeyValueStorage;
  scope: OfflineQueueScope;
  namespace?: string;
}): Promise<ScopedOfflineQueueRecoveryResult> {
  const { storage, scope } = input;
  const namespace = input.namespace ?? DEFAULT_SCOPED_OFFLINE_QUEUE_NAMESPACE;
  const currentScope: OfflineQueueScope = {
    tenantId: scope.tenantId.trim(),
    branchId: scope.branchId.trim(),
    terminalId: scope.terminalId.trim(),
    userId: scope.userId.trim(),
    terminalCredentialVersion: scope.terminalCredentialVersion,
  };
  const currentQueueKey = buildScopedOfflineQueueKey(currentScope, namespace);
  const legacyQueueKey = buildLegacyScopedOfflineQueueKey(currentScope);
  const storageKeys = storage.keys ? await storage.keys() : [];
  const relatedQueues = [...new Set(storageKeys)]
    .map((queueKey) => parseScopedOfflineQueueKey(queueKey, namespace))
    .filter(
      (parsed): parsed is ParsedScopedOfflineQueueKey =>
        parsed !== null &&
        parsed.queueKey !== currentQueueKey &&
        parsed.tenantId === currentScope.tenantId &&
        parsed.terminalId === currentScope.terminalId,
    );

  const lockKeys = [
    currentQueueKey,
    legacyQueueKey,
    ...relatedQueues.map((candidate) => candidate.queueKey),
  ];

  return runQueueReplayExclusiveMany(lockKeys, () =>
    runQueueStateExclusiveMany(lockKeys, async () => {
      const quarantined: ScopedOfflineQueueQuarantine[] = [];

      const candidates = await Promise.all(
        relatedQueues.map(async (parsed) => ({
          parsed,
          items: await readOfflineQueueFromStorage(storage, parsed.queueKey),
        })),
      );
      const legacyItems = await readOfflineQueueFromStorage(
        storage,
        legacyQueueKey,
      );

      for (const { parsed, items } of candidates) {
        const pendingCount = items.filter(
          (item) => item.status === "pending",
        ).length;
        if (pendingCount === 0) {
          continue;
        }

        const reasons: ScopedOfflineQueueQuarantineReason[] = [];
        if (parsed.branchId !== currentScope.branchId) {
          reasons.push("branch_mismatch");
        }
        if (parsed.userId !== currentScope.userId) {
          reasons.push("user_mismatch");
        }
        if (
          parsed.terminalCredentialVersion !==
          currentScope.terminalCredentialVersion
        ) {
          // A credential epoch changes only for a terminal, branch, or tenant
          // security lifecycle event. The client cannot prove whether an old
          // offline command was created before or after revocation while the
          // device was disconnected, so no old epoch may be re-signed and
          // replayed automatically by a new authenticated session.
          reasons.push("credential_epoch_mismatch");
        }
        if (
          parsed.terminalCredentialVersion >
          currentScope.terminalCredentialVersion
        ) {
          reasons.push("future_epoch");
        } else if (
          parsed.terminalCredentialVersion ===
          currentScope.terminalCredentialVersion
        ) {
          reasons.push("non_previous_epoch");
        }

        quarantined.push({
          queueKey: parsed.queueKey,
          scope: {
            tenantId: parsed.tenantId,
            branchId: parsed.branchId,
            terminalId: parsed.terminalId,
            userId: parsed.userId,
            terminalCredentialVersion: parsed.terminalCredentialVersion,
          },
          pendingCount,
          reasons,
        });
      }

      const legacyPendingCount = legacyItems.filter(
        (item) => item.status === "pending",
      ).length;
      if (legacyPendingCount > 0) {
        quarantined.push({
          queueKey: legacyQueueKey,
          scope: {
            tenantId: currentScope.tenantId,
            branchId: currentScope.branchId,
            terminalId: currentScope.terminalId,
            userId: null,
            terminalCredentialVersion: null,
          },
          pendingCount: legacyPendingCount,
          reasons: ["legacy_scope_unattributed"],
        });
      }

      return {
        storageEnumerationSupported: Boolean(storage.keys),
        migratedItemCount: 0,
        migratedQueueKeys: [],
        quarantinedItemCount: quarantined.reduce(
          (total, entry) => total + entry.pendingCount,
          0,
        ),
        quarantined,
      };
    }),
  );
}

export function createScopedPrintJobQueue<TPayload>(input: {
  storage: AsyncKeyValueStorage;
  scope: PersistentPrintJobQueueScope;
  namespace?: string;
}): PersistentPrintJobQueue<TPayload> {
  return new PersistentPrintJobQueue<TPayload>({
    storage: input.storage,
    queueKey: buildScopedPrintJobQueueKey(
      input.scope,
      input.namespace ?? DEFAULT_PRINT_QUEUE_KEY,
    ),
  });
}

export class OfflineQueue {
  private readonly storage: AsyncKeyValueStorage;
  private readonly queueKey: string;

  constructor(options: OfflineQueueOptions) {
    this.storage = options.storage;
    this.queueKey = options.queueKey ?? DEFAULT_QUEUE_KEY;
  }

  async enqueue<TPayload = unknown>(
    input: EnqueueInput<TPayload>,
  ): Promise<OfflineQueueItem<TPayload>> {
    return runQueueStateExclusive(this.queueKey, async () => {
      const queue = await this.readQueue<TPayload>();
      const existing = queue.find(
        (item) =>
          (input.id !== undefined && item.id === input.id) ||
          (input.idempotencyKey !== undefined &&
            item.idempotencyKey === input.idempotencyKey),
      );
      if (existing) {
        return existing;
      }

      const now = new Date().toISOString();
      const sequence = queue.reduce(
        (highest, queuedItem) => Math.max(highest, queuedItem.sequence),
        0,
      ) + 1;
      const item: OfflineQueueItem<TPayload> = {
        id: input.id ?? createId(),
        sequence,
        entity: input.entity,
        operation: input.operation,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? createId(),
        status: "pending",
        attempt: 0,
        createdAt: now,
        updatedAt: now,
        metadata: input.metadata,
      };

      queue.push(item);
      await this.writeQueue(queue);
      return item;
    });
  }

  async peek<TPayload = unknown>(): Promise<
    OfflineQueueItem<TPayload> | undefined
  > {
    return runQueueStateExclusive(this.queueKey, async () => {
      const queue = await this.readQueue<TPayload>();
      return queue.find((item) => item.status === "pending");
    });
  }

  async list<TPayload = unknown>(): Promise<OfflineQueueItem<TPayload>[]> {
    return runQueueStateExclusive(this.queueKey, () =>
      this.readQueue<TPayload>(),
    );
  }

  async markSynced(id: string): Promise<void> {
    await runQueueStateExclusive(this.queueKey, async () => {
      const queue = await this.readQueue();
      const nextQueue = queue.filter((item) => item.id !== id);

      if (nextQueue.length !== queue.length) {
        await this.writeQueue(nextQueue);
        return;
      }

      await this.writeQueue(
        queue.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "synced",
                syncedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastError: undefined,
              }
            : item,
        ),
      );
    });
  }

  async updatePayload<TPayload = unknown>(
    id: string,
    updater: OfflineQueuePayloadUpdater<TPayload>,
  ): Promise<OfflineQueueItem<TPayload> | undefined> {
    return runQueueStateExclusive(this.queueKey, async () => {
      const queue = await this.readQueue<TPayload>();
      const now = new Date().toISOString();
      let updated: OfflineQueueItem<TPayload> | undefined;

      const nextQueue = queue.map((item) => {
        if (item.id !== id) {
          return item;
        }

        updated = {
          ...item,
          payload: updater(item.payload),
          updatedAt: now,
          lastError: undefined,
        };
        return updated;
      });

      await this.writeQueue(nextQueue);
      return updated;
    });
  }

  async replay<TPayload = unknown>(
    handler: ReplayHandler<TPayload>,
  ): Promise<ReplayResult<TPayload>> {
    return runQueueReplayExclusive(this.queueKey, async () => {
      const replayed: OfflineQueueItem<TPayload>[] = [];

      while (true) {
        const item = await this.peek<TPayload>();

        if (!item) {
          return { replayed };
        }

        try {
          await handler(item);
          replayed.push(item);
          await this.markSynced(item.id);
        } catch (error) {
          const failed = await this.recordFailure<TPayload>(item.id, error);
          return { replayed, failed };
        }
      }
    });
  }

  /**
   * Replays every operation whose dependencies are no longer pending.
   *
   * Unlike replay(), a failed operation does not stop independent work. It is
   * attempted at most once during this call, while descendants remain pending
   * and are returned as blocked. A later call retries the failed operation and
   * can then continue through its dependency chain.
   */
  async replayAvailable<TPayload = unknown>(
    handler: ReplayHandler<TPayload>,
  ): Promise<ReplayAvailableResult<TPayload>> {
    return runQueueReplayExclusive(this.queueKey, async () => {
      const replayed: OfflineQueueItem<TPayload>[] = [];
      const failed: OfflineQueueItem<TPayload>[] = [];
      const attemptedOperationIds = new Set<string>();
      const failedOperationIds = new Set<string>();

      while (true) {
        const pending = (await this.list<TPayload>()).filter(
          (item) => item.status === "pending",
        );
        const pendingOperationIds = new Set(pending.map((item) => item.id));
        const next = pending.find(
          (item) =>
            !attemptedOperationIds.has(item.id) &&
            getDependencyOperationIds(item).every(
              (dependencyId) => !pendingOperationIds.has(dependencyId),
            ),
        );

        if (!next) {
          const pendingById = new Map(pending.map((item) => [item.id, item]));
          const blocked = pending
            .filter((item) => !failedOperationIds.has(item.id))
            .map((item): ReplayBlockedItem<TPayload> => {
              const dependencyOperationIds = getDependencyOperationIds(item);
              const blockingOperationIds = dependencyOperationIds.filter(
                (dependencyId) => pendingById.has(dependencyId),
              );
              const failedDependencyOperationIds =
                collectFailedDependencyOperationIds(
                  item,
                  pendingById,
                  failedOperationIds,
                );

              return {
                item,
                reason:
                  failedDependencyOperationIds.length > 0
                    ? "dependency_failed"
                    : "dependency_pending",
                dependencyOperationIds,
                blockingOperationIds,
                failedDependencyOperationIds,
              };
            });

          return { replayed, failed, blocked };
        }

        attemptedOperationIds.add(next.id);
        try {
          await handler(next);
          await this.markSynced(next.id);
          replayed.push(next);
        } catch (error) {
          const failedItem = await this.recordFailure<TPayload>(next.id, error);
          failed.push(failedItem);
          failedOperationIds.add(failedItem.id);
        }
      }
    });
  }

  private async recordFailure<TPayload = unknown>(
    id: string,
    error: unknown,
  ): Promise<OfflineQueueItem<TPayload>> {
    return runQueueStateExclusive(this.queueKey, async () => {
      const queue = await this.readQueue<TPayload>();
      const now = new Date().toISOString();
      const message = getErrorMessage(error);
      let failed: OfflineQueueItem<TPayload> | undefined;

      const nextQueue = queue.map((item) => {
        if (item.id !== id) {
          return item;
        }

        failed = {
          ...item,
          status: "pending",
          attempt: item.attempt + 1,
          lastError: message,
          updatedAt: now,
        };
        return failed;
      });

      await this.writeQueue(nextQueue);

      if (!failed) {
        throw new Error(`Offline queue item not found: ${id}`);
      }

      return failed;
    });
  }

  private async readQueue<TPayload = unknown>(): Promise<
    OfflineQueueItem<TPayload>[]
  > {
    const rawValue = await this.storage.getItem(this.queueKey);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as OfflineQueueItem<TPayload>[];
    if (!Array.isArray(parsed)) return [];

    // v1/v2 queues had timestamps but no explicit sequence. Preserve their
    // array order during the one-time in-memory upgrade.
    return parsed.map((item, index) => ({
      ...item,
      sequence:
        Number.isSafeInteger(item.sequence) && item.sequence > 0
          ? item.sequence
          : index + 1,
    }));
  }

  private async writeQueue(queue: OfflineQueueItem[]): Promise<void> {
    if (queue.length === 0 && this.storage.removeItem) {
      await this.storage.removeItem(this.queueKey);
      return;
    }

    await this.storage.setItem(this.queueKey, JSON.stringify(queue));
  }
}

export class PersistentPrintJobQueue<TPayload = unknown> {
  private readonly storage: AsyncKeyValueStorage;
  private readonly queueKey: string;

  constructor(options: OfflineQueueOptions) {
    this.storage = options.storage;
    this.queueKey = options.queueKey ?? DEFAULT_PRINT_QUEUE_KEY;
  }

  async enqueue(
    input: EnqueuePrintJobInput<TPayload>,
  ): Promise<PersistentPrintJob<TPayload>> {
    return runQueueStateExclusive(this.queueKey, async () => {
      const jobs = await this.readJobs();
      const idempotencyKey = input.idempotencyKey ?? createId();
      const existing = jobs.find(
        (job) => job.idempotencyKey === idempotencyKey,
      );
      if (existing) return existing;

      const now = new Date().toISOString();
      const job: PersistentPrintJob<TPayload> = {
        id: input.id ?? createId(),
        idempotencyKey,
        payload: input.payload,
        status: "pending",
        attempt: 0,
        createdAt: now,
        updatedAt: now,
      };
      jobs.push(job);
      await this.writeJobs(jobs);
      return job;
    });
  }

  async list(): Promise<PersistentPrintJob<TPayload>[]> {
    return runQueueStateExclusive(this.queueKey, () => this.readJobs());
  }

  async updatePayload(
    jobId: string,
    updater: PersistentPrintJobPayloadUpdater<TPayload>,
  ): Promise<PersistentPrintJob<TPayload> | undefined> {
    return runQueueStateExclusive(this.queueKey, async () => {
      const jobs = await this.readJobs();
      let updated: PersistentPrintJob<TPayload> | undefined;
      const nextJobs = jobs.map((job) => {
        if (job.id !== jobId) return job;
        updated = {
          ...job,
          payload: updater(job.payload),
          updatedAt: new Date().toISOString(),
        };
        return updated;
      });
      if (updated) await this.writeJobs(nextJobs);
      return updated;
    });
  }

  async replay(
    handler: PrintJobHandler<TPayload>,
  ): Promise<PrintJobReplayResult<TPayload>> {
    return runQueueReplayExclusive(this.queueKey, async () => {
      const printed: PersistentPrintJob<TPayload>[] = [];

      while (true) {
        const jobs = await this.list();
        const next = jobs.find(
          (job) => job.status === "pending" || job.status === "failed",
        );
        if (!next) {
          const uncertain = jobs.find((job) => job.status === "printing");
          return uncertain ? { printed, failed: uncertain } : { printed };
        }

        const result = await this.execute(next.id, handler);
        if (result.status === "failed") return { printed, failed: result };
        printed.push(result);
      }
    });
  }

  async retry(
    jobId: string,
    handler: PrintJobHandler<TPayload>,
  ): Promise<PersistentPrintJob<TPayload>> {
    return runQueueReplayExclusive(this.queueKey, async () => {
      const jobs = await this.list();
      const job = jobs.find((candidate) => candidate.id === jobId);
      if (!job) throw new Error(`Print job not found: ${jobId}`);
      if (job.status === "printed") return job;
      if (job.status === "printing") {
        throw new Error(
          "Print job outcome is uncertain. Verify the physical output and use an authorized reprint instead.",
        );
      }
      return this.execute(jobId, handler);
    });
  }

  async clearPrinted(): Promise<void> {
    await runQueueStateExclusive(this.queueKey, async () => {
      const jobs = await this.readJobs();
      await this.writeJobs(jobs.filter((job) => job.status !== "printed"));
    });
  }

  private async execute(
    jobId: string,
    handler: PrintJobHandler<TPayload>,
  ): Promise<PersistentPrintJob<TPayload>> {
    const printing = await runQueueStateExclusive(this.queueKey, async () => {
      let jobs = await this.readJobs();
      const current = jobs.find((job) => job.id === jobId);
      if (!current) throw new Error(`Print job not found: ${jobId}`);
      if (current.status === "printed") return current;

      const next: PersistentPrintJob<TPayload> = {
        ...current,
        status: "printing",
        attempt: current.attempt + 1,
        updatedAt: new Date().toISOString(),
        lastError: undefined,
      };
      jobs = jobs.map((job) => (job.id === jobId ? next : job));
      await this.writeJobs(jobs);
      return next;
    });
    if (printing.status === "printed") return printing;

    try {
      await handler(printing);
      const printed: PersistentPrintJob<TPayload> = {
        ...printing,
        status: "printed",
        printedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.replaceJob(printed);
      return printed;
    } catch (error) {
      const failed: PersistentPrintJob<TPayload> = {
        ...printing,
        status: "failed",
        lastError: getErrorMessage(error),
        updatedAt: new Date().toISOString(),
      };
      await this.replaceJob(failed);
      return failed;
    }
  }

  private async replaceJob(next: PersistentPrintJob<TPayload>): Promise<void> {
    await runQueueStateExclusive(this.queueKey, async () => {
      const jobs = await this.readJobs();
      await this.writeJobs(
        jobs.map((job) => (job.id === next.id ? next : job)),
      );
    });
  }

  private async readJobs(): Promise<PersistentPrintJob<TPayload>[]> {
    const raw = await this.storage.getItem(this.queueKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistentPrintJob<TPayload>[];
    return Array.isArray(parsed) ? parsed : [];
  }

  private async writeJobs(jobs: PersistentPrintJob<TPayload>[]): Promise<void> {
    if (jobs.length === 0 && this.storage.removeItem) {
      await this.storage.removeItem(this.queueKey);
      return;
    }
    await this.storage.setItem(this.queueKey, JSON.stringify(jobs));
  }
}

export class DeliveryTaskCache<
  TTask extends DeliveryTaskSummary = DeliveryTaskSummary,
  TDetail extends DeliveryTaskDetail = DeliveryTaskDetail,
> {
  private readonly storage: AsyncKeyValueStorage;
  private readonly cacheKey: string;

  constructor(options: DeliveryTaskCacheOptions) {
    this.storage = options.storage;
    this.cacheKey = options.cacheKey ?? DEFAULT_DELIVERY_TASK_CACHE_KEY;
  }

  async saveTasks(
    tasks: TTask[],
  ): Promise<DeliveryTaskCacheSnapshot<TTask, TDetail>> {
    const snapshot = await this.readSnapshot();
    const nextSnapshot: DeliveryTaskCacheSnapshot<TTask, TDetail> = {
      ...snapshot,
      loadedAt: new Date().toISOString(),
      tasks,
    };

    await this.writeSnapshot(nextSnapshot);
    return nextSnapshot;
  }

  async getTasks(): Promise<TTask[]> {
    const snapshot = await this.readSnapshot();
    return snapshot.tasks;
  }

  async saveTaskDetail(
    detail: TDetail,
  ): Promise<DeliveryTaskCacheSnapshot<TTask, TDetail>> {
    const snapshot = await this.readSnapshot();
    const nextSnapshot: DeliveryTaskCacheSnapshot<TTask, TDetail> = {
      ...snapshot,
      loadedAt: new Date().toISOString(),
      details: {
        ...snapshot.details,
        [detail.id]: detail,
      },
    };

    await this.writeSnapshot(nextSnapshot);
    return nextSnapshot;
  }

  async getTaskDetail(taskId: string): Promise<TDetail | undefined> {
    const snapshot = await this.readSnapshot();
    return snapshot.details[taskId];
  }

  async readSnapshot(): Promise<DeliveryTaskCacheSnapshot<TTask, TDetail>> {
    const rawValue = await this.storage.getItem(this.cacheKey);

    if (!rawValue) {
      return createEmptyDeliveryTaskSnapshot<TTask, TDetail>();
    }

    const parsed = JSON.parse(rawValue) as DeliveryTaskCacheSnapshot<
      TTask,
      TDetail
    >;

    return {
      loadedAt: parsed.loadedAt ?? new Date(0).toISOString(),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      details: parsed.details ?? {},
    };
  }

  async clear(): Promise<void> {
    if (this.storage.removeItem) {
      await this.storage.removeItem(this.cacheKey);
      return;
    }

    await this.writeSnapshot(createEmptyDeliveryTaskSnapshot<TTask, TDetail>());
  }

  private async writeSnapshot(
    snapshot: DeliveryTaskCacheSnapshot<TTask, TDetail>,
  ): Promise<void> {
    await this.storage.setItem(this.cacheKey, JSON.stringify(snapshot));
  }
}

export function createOfflineQueue(options: OfflineQueueOptions): OfflineQueue {
  return new OfflineQueue(options);
}

export function createDeliveryTaskCache<
  TTask extends DeliveryTaskSummary = DeliveryTaskSummary,
  TDetail extends DeliveryTaskDetail = DeliveryTaskDetail,
>(options: DeliveryTaskCacheOptions): DeliveryTaskCache<TTask, TDetail> {
  return new DeliveryTaskCache<TTask, TDetail>(options);
}

export async function enqueue<TPayload = unknown>(
  queue: OfflineQueue,
  input: EnqueueInput<TPayload>,
): Promise<OfflineQueueItem<TPayload>> {
  return queue.enqueue(input);
}

export async function peek<TPayload = unknown>(
  queue: OfflineQueue,
): Promise<OfflineQueueItem<TPayload> | undefined> {
  return queue.peek<TPayload>();
}

export async function markSynced(
  queue: OfflineQueue,
  id: string,
): Promise<void> {
  await queue.markSynced(id);
}

export async function updatePayload<TPayload = unknown>(
  queue: OfflineQueue,
  id: string,
  updater: OfflineQueuePayloadUpdater<TPayload>,
): Promise<OfflineQueueItem<TPayload> | undefined> {
  return queue.updatePayload(id, updater);
}

export async function replay<TPayload = unknown>(
  queue: OfflineQueue,
  handler: ReplayHandler<TPayload>,
): Promise<ReplayResult<TPayload>> {
  return queue.replay(handler);
}

export async function replayAvailable<TPayload = unknown>(
  queue: OfflineQueue,
  handler: ReplayHandler<TPayload>,
): Promise<ReplayAvailableResult<TPayload>> {
  return queue.replayAvailable(handler);
}

async function readOfflineQueueFromStorage(
  storage: AsyncKeyValueStorage,
  queueKey: string,
): Promise<OfflineQueueItem[]> {
  const rawValue = await storage.getItem(queueKey);
  if (!rawValue) {
    return [];
  }

  const parsed = JSON.parse(rawValue) as OfflineQueueItem[];
  return Array.isArray(parsed) ? parsed : [];
}

function createEmptyDeliveryTaskSnapshot<
  TTask extends DeliveryTaskSummary,
  TDetail extends DeliveryTaskDetail,
>(): DeliveryTaskCacheSnapshot<TTask, TDetail> {
  return {
    loadedAt: new Date(0).toISOString(),
    tasks: [],
    details: {},
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Offline replay failed.";
}

function getDependencyOperationIds(item: OfflineQueueItem): string[] {
  const value = item.metadata?.dependsOnOperationIds;
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (dependencyId): dependencyId is string =>
          typeof dependencyId === "string" && dependencyId.length > 0,
      ),
    ),
  ];
}

function collectFailedDependencyOperationIds<TPayload>(
  item: OfflineQueueItem<TPayload>,
  pendingById: Map<string, OfflineQueueItem<TPayload>>,
  failedOperationIds: Set<string>,
  visited = new Set<string>(),
): string[] {
  const failures = new Set<string>();

  for (const dependencyId of getDependencyOperationIds(item)) {
    if (failedOperationIds.has(dependencyId)) {
      failures.add(dependencyId);
      continue;
    }

    if (visited.has(dependencyId)) {
      continue;
    }

    const dependency = pendingById.get(dependencyId);
    if (!dependency) {
      continue;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(dependencyId);
    for (const failureId of collectFailedDependencyOperationIds(
      dependency,
      pendingById,
      failedOperationIds,
      nextVisited,
    )) {
      failures.add(failureId);
    }
  }

  return [...failures];
}
