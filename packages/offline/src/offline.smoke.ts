import {
  buildScopedOfflineQueueKey,
  createDeliveryTaskCache,
  createMemoryStorage,
  createOfflineQueue,
  createScopedOfflineQueue,
  createScopedPrintJobQueue,
} from "./index";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const storage = createMemoryStorage();
const queue = createOfflineQueue({ storage });

const first = await queue.enqueue({
  entity: "deliveryTask",
  operation: "update",
  payload: { taskId: "task_1", status: "arrived" },
});

const second = await queue.enqueue({
  entity: "deliveryProof",
  operation: "create",
  payload: { taskId: "task_1", type: "pickup", mediaRef: "local://photo" },
});

const duplicateFirst = await queue.enqueue({
  entity: "deliveryTask",
  operation: "update",
  payload: { taskId: "task_1", status: "duplicate" },
  idempotencyKey: first.idempotencyKey,
});

assert(
  duplicateFirst.id === first.id && (await queue.list()).length === 2,
  "duplicate operation idempotency keys must reuse the queued item",
);

assert(first.idempotencyKey.length === 26, "idempotency key should be a ULID");
assert((await queue.peek())?.id === first.id, "peek should return the first item");

const replayedIds: string[] = [];
const firstReplay = await queue.replay(async (item) => {
  replayedIds.push(item.id);

  if (item.id === second.id) {
    throw new Error("network unavailable");
  }
});

assert(
  firstReplay.replayed.length === 1 && firstReplay.replayed[0]?.id === first.id,
  "replay should stop after the first failed item",
);
assert(firstReplay.failed?.id === second.id, "failed item should be reported");
assert(firstReplay.failed.attempt === 1, "failed item attempt should increment");
assert(
  (await queue.peek())?.id === second.id,
  "failed item should stay at the front of the queue",
);

const secondReplay = await queue.replay(async (item) => {
  replayedIds.push(item.id);
});

assert(
  secondReplay.replayed.length === 1 && secondReplay.replayed[0]?.id === second.id,
  "retry should replay the retained failed item",
);
assert((await queue.peek()) === undefined, "queue should be empty after success");
assert(
  replayedIds.join(",") === [first.id, second.id, second.id].join(","),
  "items should replay in queue order with retry",
);

const cache = createDeliveryTaskCache({ storage });
await cache.saveTasks([
  {
    id: "task_1",
    status: "arrived",
    customer: { name: "Demo Customer" },
  },
]);
await cache.saveTaskDetail({
  id: "task_1",
  status: "arrived",
  customer: { name: "Demo Customer", phone: "+000" },
  events: [{ status: "arrived" }],
});

assert((await cache.getTasks()).length === 1, "cached tasks should be readable");
assert(
  (await cache.getTaskDetail("task_1"))?.customer?.name === "Demo Customer",
  "cached task detail should be readable",
);

const sharedScopedStorage = createMemoryStorage();
const branchAQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_1",
  },
});

const branchBQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_b",
    terminalId: "terminal_1",
  },
});
const terminalBQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_2",
  },
});
await branchAQueue.enqueue({
  entity: "order",
  operation: "create",
  payload: { orderId: "order_1" },
});
assert(
  (await branchAQueue.list()).length === 1,
  "scoped queue should retain its item",
);
assert(
  (await branchBQueue.list()).length === 0,
  "scoped queues must be branch isolated",
);
assert(
  (await terminalBQueue.list()).length === 0,
  "scoped queues must be terminal isolated",
);
assert(
  buildScopedOfflineQueueKey({
    tenantId: "tenant:1",
    branchId: "branch/1",
    terminalId: "terminal 1",
  }).includes("tenant%3A1:branch%2F1:terminal%201"),
  "scoped queue key should encode identifiers",
);

let invalidScopeRejected = false;
try {
  buildScopedOfflineQueueKey({
    tenantId: "tenant_1",
    branchId: "",
    terminalId: "terminal_1",
  });
} catch {
  invalidScopeRejected = true;
}
assert(invalidScopeRejected, "an incomplete POS scope must be rejected");

const persistedFailure = await branchAQueue.replay(async () => {
  throw new Error("blocking conflict");
});
assert(
  persistedFailure.failed?.lastError === "blocking conflict",
  "blocking replay error should be stored",
);
const reopenedBranchAQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_1",
  },
});
assert(
  (await reopenedBranchAQueue.peek())?.lastError === "blocking conflict",
  "blocking replay error should survive queue recreation",
);

const printQueueScope = {
  tenantId: "tenant_1",
  branchId: "branch_a",
  terminalId: "terminal_1",
};
const printQueue = createScopedPrintJobQueue<{ content: string }>({
  storage: sharedScopedStorage,
  scope: printQueueScope,
});
const printJob = await printQueue.enqueue({
  id: "print_job_1",
  idempotencyKey: "receipt_order_1",
  payload: { content: "Receipt OD-12345678" },
});
const duplicatePrintJob = await printQueue.enqueue({
  id: "print_job_duplicate",
  idempotencyKey: "receipt_order_1",
  payload: { content: "Duplicate receipt" },
});
assert(
  duplicatePrintJob.id === printJob.id && (await printQueue.list()).length === 1,
  "duplicate print idempotency keys must not create another job",
);

const failedPrintReplay = await printQueue.replay(async () => {
  throw new Error("printer disconnected");
});
assert(
  failedPrintReplay.failed?.id === printJob.id &&
    failedPrintReplay.failed.status === "failed" &&
    failedPrintReplay.failed.attempt === 1 &&
    failedPrintReplay.failed.lastError === "printer disconnected",
  "failed print details should be retained for retry",
);

const reopenedPrintQueue = createScopedPrintJobQueue<{ content: string }>({
  storage: sharedScopedStorage,
  scope: printQueueScope,
});
const persistedPrintJob = (await reopenedPrintQueue.list())[0];
assert(
  persistedPrintJob?.id === printJob.id &&
    persistedPrintJob.status === "failed" &&
    persistedPrintJob.lastError === "printer disconnected",
  "failed print state should survive queue recreation",
);

const retriedPrintJob = await reopenedPrintQueue.retry(
  printJob.id,
  async (job) => {
    assert(
      job.id === printJob.id && job.payload.content === "Receipt OD-12345678",
      "retry should use the original stable job",
    );
  },
);
assert(
  retriedPrintJob.id === printJob.id &&
    retriedPrintJob.status === "printed" &&
    retriedPrintJob.attempt === 2 &&
    Boolean(retriedPrintJob.printedAt),
  "retry should print the same job and persist success",
);

console.log("offline smoke ok");
