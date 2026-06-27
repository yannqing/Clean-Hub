import { createId } from "@cleanhub/id";

export type OfflineOperation = "create" | "update" | "delete";
export type OfflineQueueItemStatus = "pending" | "synced";

export type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
};

export type PreferencesLikeStorage = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove?(options: { key: string }): Promise<void>;
};

export type OfflineQueueItem<TPayload = unknown> = {
  id: string;
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

export type DeliveryTaskCacheOptions = {
  storage: AsyncKeyValueStorage;
  cacheKey?: string;
};

const DEFAULT_QUEUE_KEY = "cleanhub.offline.queue.v1";
const DEFAULT_DELIVERY_TASK_CACHE_KEY = "cleanhub.offline.deliveryTasks.v1";

export function createPreferencesStorageAdapter(
  preferences: PreferencesLikeStorage,
): AsyncKeyValueStorage {
  return {
    async getItem(key) {
      const result = await preferences.get({ key });
      return result.value;
    },
    async setItem(key, value) {
      await preferences.set({ key, value });
    },
    async removeItem(key) {
      await preferences.remove?.({ key });
    },
  };
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
  };
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
    const queue = await this.readQueue();
    const now = new Date().toISOString();
    const item: OfflineQueueItem<TPayload> = {
      id: input.id ?? createId(),
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
  }

  async peek<TPayload = unknown>(): Promise<
    OfflineQueueItem<TPayload> | undefined
  > {
    const queue = await this.readQueue<TPayload>();
    return queue.find((item) => item.status === "pending");
  }

  async list<TPayload = unknown>(): Promise<OfflineQueueItem<TPayload>[]> {
    return this.readQueue<TPayload>();
  }

  async markSynced(id: string): Promise<void> {
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
  }

  async replay<TPayload = unknown>(
    handler: ReplayHandler<TPayload>,
  ): Promise<ReplayResult<TPayload>> {
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
  }

  private async recordFailure<TPayload = unknown>(
    id: string,
    error: unknown,
  ): Promise<OfflineQueueItem<TPayload>> {
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
  }

  private async readQueue<TPayload = unknown>(): Promise<
    OfflineQueueItem<TPayload>[]
  > {
    const rawValue = await this.storage.getItem(this.queueKey);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as OfflineQueueItem<TPayload>[];
    return Array.isArray(parsed) ? parsed : [];
  }

  private async writeQueue(queue: OfflineQueueItem[]): Promise<void> {
    if (queue.length === 0 && this.storage.removeItem) {
      await this.storage.removeItem(this.queueKey);
      return;
    }

    await this.storage.setItem(this.queueKey, JSON.stringify(queue));
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

  async saveTasks(tasks: TTask[]): Promise<DeliveryTaskCacheSnapshot<TTask, TDetail>> {
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

  async saveTaskDetail(detail: TDetail): Promise<DeliveryTaskCacheSnapshot<TTask, TDetail>> {
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

export async function replay<TPayload = unknown>(
  queue: OfflineQueue,
  handler: ReplayHandler<TPayload>,
): Promise<ReplayResult<TPayload>> {
  return queue.replay(handler);
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
