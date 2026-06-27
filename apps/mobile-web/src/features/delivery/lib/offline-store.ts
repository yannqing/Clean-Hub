import type {
  DeliveryOfflinePayload,
  DeliveryOfflineQueueItem,
  DeliveryQueueSummary,
  DeliveryReplaySummary,
  DeliveryTaskCacheSnapshot,
  DeliveryTaskDetail,
  DeliveryTaskListItem,
} from "../types";
import { createLocalId } from "./id";
import { createDeliveryStorage, type DeliveryStorage } from "./storage";

const QUEUE_KEY = "cleanhub.mobile.delivery.queue.v1";
const CACHE_KEY = "cleanhub.mobile.delivery.tasks.v1";
const OFFLINE_PACKAGE_NAME = "@cleanhub/offline";

type SharedOfflineQueue = {
  enqueue<TPayload>(input: {
    entity: string;
    operation: "create" | "update" | "delete";
    payload: TPayload;
    id?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<DeliveryOfflineQueueItem>;
  list(): Promise<DeliveryOfflineQueueItem[]>;
  markSynced(id: string): Promise<void>;
  replay(
    handler: (item: DeliveryOfflineQueueItem) => Promise<void>,
  ): Promise<DeliveryReplaySummary>;
};

type SharedDeliveryTaskCache = {
  saveTasks(tasks: DeliveryTaskListItem[]): Promise<DeliveryTaskCacheSnapshot>;
  getTasks(): Promise<DeliveryTaskListItem[]>;
  saveTaskDetail(detail: DeliveryTaskDetail): Promise<DeliveryTaskCacheSnapshot>;
  getTaskDetail(taskId: string): Promise<DeliveryTaskDetail | undefined>;
  readSnapshot(): Promise<DeliveryTaskCacheSnapshot>;
};

type SharedOfflineModule = {
  createOfflineQueue(options: {
    storage: DeliveryStorage;
    queueKey?: string;
  }): SharedOfflineQueue;
  createDeliveryTaskCache(options: {
    storage: DeliveryStorage;
    cacheKey?: string;
  }): SharedDeliveryTaskCache;
};

let sharedModulePromise: Promise<SharedOfflineModule | null> | null = null;
let queuePromise: Promise<SharedOfflineQueue | LocalDeliveryQueue> | null = null;
let cachePromise: Promise<SharedDeliveryTaskCache | LocalDeliveryTaskCache> | null = null;

function emptySnapshot(): DeliveryTaskCacheSnapshot {
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

  return "Synchronisation impossible pour le moment.";
}

async function loadSharedOfflineModule(): Promise<SharedOfflineModule | null> {
  if (!sharedModulePromise) {
    sharedModulePromise = import(OFFLINE_PACKAGE_NAME)
      .then((module) => module as SharedOfflineModule)
      .catch(() => null);
  }

  return sharedModulePromise;
}

class LocalDeliveryQueue {
  constructor(private readonly storage: DeliveryStorage) {}

  async enqueue(input: {
    entity: string;
    operation: "create" | "update" | "delete";
    payload: DeliveryOfflinePayload;
    id?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<DeliveryOfflineQueueItem> {
    const queue = await this.readQueue();
    const now = new Date().toISOString();
    const item: DeliveryOfflineQueueItem = {
      id: input.id ?? createLocalId(),
      entity: input.entity,
      operation: input.operation,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey ?? createLocalId(),
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

  async list(): Promise<DeliveryOfflineQueueItem[]> {
    return this.readQueue();
  }

  async markSynced(id: string): Promise<void> {
    const queue = await this.readQueue();
    await this.writeQueue(queue.filter((item) => item.id !== id));
  }

  async replay(
    handler: (item: DeliveryOfflineQueueItem) => Promise<void>,
  ): Promise<DeliveryReplaySummary> {
    const replayed: DeliveryOfflineQueueItem[] = [];

    while (true) {
      const item = (await this.readQueue()).find(
        (queueItem) => queueItem.status === "pending",
      );

      if (!item) {
        return { replayed };
      }

      try {
        await handler(item);
        replayed.push(item);
        await this.markSynced(item.id);
      } catch (error) {
        const failed = await this.recordFailure(item.id, error);
        return { replayed, failed };
      }
    }
  }

  private async recordFailure(
    id: string,
    error: unknown,
  ): Promise<DeliveryOfflineQueueItem> {
    const queue = await this.readQueue();
    const now = new Date().toISOString();
    let failed: DeliveryOfflineQueueItem | undefined;

    const nextQueue = queue.map((item) => {
      if (item.id !== id) {
        return item;
      }

      failed = {
        ...item,
        attempt: item.attempt + 1,
        lastError: getErrorMessage(error),
        updatedAt: now,
      };
      return failed;
    });

    await this.writeQueue(nextQueue);

    if (!failed) {
      throw new Error("Operation hors ligne introuvable.");
    }

    return failed;
  }

  private async readQueue(): Promise<DeliveryOfflineQueueItem[]> {
    const raw = await this.storage.getItem(QUEUE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as DeliveryOfflineQueueItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeQueue(queue: DeliveryOfflineQueueItem[]): Promise<void> {
    if (queue.length === 0) {
      await this.storage.removeItem(QUEUE_KEY);
      return;
    }

    await this.storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

class LocalDeliveryTaskCache {
  constructor(private readonly storage: DeliveryStorage) {}

  async saveTasks(tasks: DeliveryTaskListItem[]): Promise<DeliveryTaskCacheSnapshot> {
    const snapshot = await this.readSnapshot();
    const nextSnapshot: DeliveryTaskCacheSnapshot = {
      ...snapshot,
      loadedAt: new Date().toISOString(),
      tasks,
    };

    await this.writeSnapshot(nextSnapshot);
    return nextSnapshot;
  }

  async getTasks(): Promise<DeliveryTaskListItem[]> {
    return (await this.readSnapshot()).tasks;
  }

  async saveTaskDetail(detail: DeliveryTaskDetail): Promise<DeliveryTaskCacheSnapshot> {
    const snapshot = await this.readSnapshot();
    const nextSnapshot: DeliveryTaskCacheSnapshot = {
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

  async getTaskDetail(taskId: string): Promise<DeliveryTaskDetail | undefined> {
    return (await this.readSnapshot()).details[taskId];
  }

  async readSnapshot(): Promise<DeliveryTaskCacheSnapshot> {
    const raw = await this.storage.getItem(CACHE_KEY);

    if (!raw) {
      return emptySnapshot();
    }

    try {
      const parsed = JSON.parse(raw) as DeliveryTaskCacheSnapshot;
      return {
        loadedAt: parsed.loadedAt ?? new Date(0).toISOString(),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        details: parsed.details ?? {},
      };
    } catch {
      return emptySnapshot();
    }
  }

  private async writeSnapshot(snapshot: DeliveryTaskCacheSnapshot): Promise<void> {
    await this.storage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  }
}

async function getQueue() {
  if (!queuePromise) {
    queuePromise = loadSharedOfflineModule().then((offline) => {
      const storage = createDeliveryStorage();
      return offline
        ? offline.createOfflineQueue({ storage, queueKey: QUEUE_KEY })
        : new LocalDeliveryQueue(storage);
    });
  }

  return queuePromise;
}

async function getCache() {
  if (!cachePromise) {
    cachePromise = loadSharedOfflineModule().then((offline) => {
      const storage = createDeliveryStorage();
      return offline
        ? offline.createDeliveryTaskCache({ storage, cacheKey: CACHE_KEY })
        : new LocalDeliveryTaskCache(storage);
    });
  }

  return cachePromise;
}

export async function enqueueDeliveryOperation(
  payload: DeliveryOfflinePayload,
  metadata?: Record<string, unknown>,
): Promise<DeliveryOfflineQueueItem> {
  const queue = await getQueue();

  return queue.enqueue({
    entity: "delivery-task",
    operation: "update",
    payload,
    idempotencyKey: payload.request.idempotencyKey,
    metadata,
  });
}

export async function listDeliveryQueue(): Promise<DeliveryQueueSummary> {
  const queue = await getQueue();
  const items = await queue.list();

  return {
    count: items.filter((item) => item.status === "pending").length,
    items,
  };
}

export async function replayDeliveryQueue(
  handler: (item: DeliveryOfflineQueueItem) => Promise<void>,
): Promise<DeliveryReplaySummary> {
  const queue = await getQueue();
  return queue.replay(handler);
}

export async function saveCachedDeliveryTasks(
  tasks: DeliveryTaskListItem[],
): Promise<DeliveryTaskCacheSnapshot> {
  const cache = await getCache();
  return cache.saveTasks(tasks);
}

export async function getCachedDeliveryTasks(): Promise<DeliveryTaskListItem[]> {
  const cache = await getCache();
  return cache.getTasks();
}

export async function saveCachedDeliveryTaskDetail(
  detail: DeliveryTaskDetail,
): Promise<DeliveryTaskCacheSnapshot> {
  const cache = await getCache();
  return cache.saveTaskDetail(detail);
}

export async function getCachedDeliveryTaskDetail(
  taskId: string,
): Promise<DeliveryTaskDetail | undefined> {
  const cache = await getCache();
  return cache.getTaskDetail(taskId);
}

export async function getDeliveryTaskCacheSnapshot(): Promise<DeliveryTaskCacheSnapshot> {
  const cache = await getCache();
  return cache.readSnapshot();
}
