import {
  buildScopedOfflineQueueKey,
  buildScopedPrintJobQueueKey,
  createDeliveryTaskCache,
  createMemoryStorage,
  createOfflineQueue,
  createPreferencesStorageAdapter,
  createScopedOfflineQueue,
  createScopedPrintJobQueue,
  parseScopedOfflineQueueKey,
  recoverScopedOfflineQueue,
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
assert(
  first.sequence === 1 && second.sequence === 2,
  "offline operations must receive a monotonic local sequence",
);
assert(
  (await queue.peek())?.id === first.id,
  "peek should return the first item",
);

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
assert(
  firstReplay.failed.attempt === 1,
  "failed item attempt should increment",
);
assert(
  (await queue.peek())?.id === second.id,
  "failed item should stay at the front of the queue",
);

const secondReplay = await queue.replay(async (item) => {
  replayedIds.push(item.id);
});

assert(
  secondReplay.replayed.length === 1 &&
    secondReplay.replayed[0]?.id === second.id,
  "retry should replay the retained failed item",
);
assert(
  (await queue.peek()) === undefined,
  "queue should be empty after success",
);
assert(
  replayedIds.join(",") === [first.id, second.id, second.id].join(","),
  "items should replay in queue order with retry",
);

const dependencyQueue = createOfflineQueue({
  storage: createMemoryStorage(),
  queueKey: "cleanhub.offline.dependency.smoke",
});
const dependentChild = await dependencyQueue.enqueue({
  id: "dependency_child",
  entity: "customerProfile",
  operation: "create",
  payload: { profileId: "profile_1" },
  metadata: { dependsOnOperationIds: ["dependency_parent"] },
});
const dependencyParent = await dependencyQueue.enqueue({
  id: "dependency_parent",
  entity: "customerAccount",
  operation: "create",
  payload: { accountId: "account_1" },
});
const independentOperation = await dependencyQueue.enqueue({
  id: "dependency_independent",
  entity: "order",
  operation: "create",
  payload: { orderId: "order_independent" },
});
const dependentGrandchild = await dependencyQueue.enqueue({
  id: "dependency_grandchild",
  entity: "order",
  operation: "create",
  payload: { orderId: "order_dependent" },
  metadata: { dependsOnOperationIds: [dependentChild.id] },
});

const dependencyAttemptCounts = new Map<string, number>();
const failedDependencyReplay = await dependencyQueue.replayAvailable(
  async (item) => {
    dependencyAttemptCounts.set(
      item.id,
      (dependencyAttemptCounts.get(item.id) ?? 0) + 1,
    );
    if (item.id === dependencyParent.id) {
      throw new Error("parent unavailable");
    }
  },
);

assert(
  failedDependencyReplay.replayed.length === 1 &&
    failedDependencyReplay.replayed[0]?.id === independentOperation.id,
  "a failed dependency chain must not stop an unrelated ready operation",
);
assert(
  failedDependencyReplay.failed.length === 1 &&
    failedDependencyReplay.failed[0]?.id === dependencyParent.id &&
    failedDependencyReplay.failed[0]?.attempt === 1 &&
    dependencyAttemptCounts.get(dependencyParent.id) === 1,
  "a failed operation must be reported and attempted only once per replay",
);
assert(
  failedDependencyReplay.blocked.length === 2 &&
    failedDependencyReplay.blocked.every(
      (entry) =>
        entry.reason === "dependency_failed" &&
        entry.failedDependencyOperationIds.includes(dependencyParent.id),
    ) &&
    failedDependencyReplay.blocked.some(
      (entry) =>
        entry.item.id === dependentChild.id &&
        entry.blockingOperationIds.includes(dependencyParent.id),
    ) &&
    failedDependencyReplay.blocked.some(
      (entry) =>
        entry.item.id === dependentGrandchild.id &&
        entry.blockingOperationIds.includes(dependentChild.id),
    ),
  "children must stay pending with enough dependency failure detail for the UI",
);

const recoveredDependencyOrder: string[] = [];
const recoveredDependencyReplay = await dependencyQueue.replayAvailable(
  async (item) => {
    recoveredDependencyOrder.push(item.id);
  },
);
assert(
  recoveredDependencyReplay.failed.length === 0 &&
    recoveredDependencyReplay.blocked.length === 0 &&
    recoveredDependencyReplay.replayed.length === 3 &&
    recoveredDependencyOrder.join(",") ===
      [dependencyParent.id, dependentChild.id, dependentGrandchild.id].join(
        ",",
      ),
  "the next replay should retry the parent and recover in dependency order",
);
assert(
  (await dependencyQueue.list()).length === 0,
  "the dependency queue should be empty after the retry succeeds",
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

assert(
  (await cache.getTasks()).length === 1,
  "cached tasks should be readable",
);
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
    userId: "user_a",
    terminalCredentialVersion: 1,
  },
});

const branchBQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_b",
    terminalId: "terminal_1",
    userId: "user_a",
    terminalCredentialVersion: 1,
  },
});
const terminalBQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_2",
    userId: "user_a",
    terminalCredentialVersion: 1,
  },
});
const userBQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_1",
    userId: "user_b",
    terminalCredentialVersion: 1,
  },
});
await branchAQueue.enqueue({
  entity: "order",
  operation: "create",
  payload: { orderId: "order_1" },
});
const nextCredentialEpochQueue = createScopedOfflineQueue({
  storage: sharedScopedStorage,
  scope: {
    tenantId: "tenant_1",
    branchId: "branch_a",
    terminalId: "terminal_1",
    userId: "user_a",
    terminalCredentialVersion: 2,
  },
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
  (await userBQueue.list()).length === 0,
  "one POS user must not see or replay another user's offline writes",
);
assert(
  (await nextCredentialEpochQueue.list()).length === 0,
  "a new terminal credential epoch must quarantine earlier offline writes",
);
assert(
  buildScopedOfflineQueueKey({
    tenantId: "tenant:1",
    branchId: "branch/1",
    terminalId: "terminal 1",
    userId: "user+1",
    terminalCredentialVersion: 7,
  }).includes("tenant%3A1:branch%2F1:terminal%201:user%2B1:epoch-7"),
  "scoped queue key should encode identifiers, the user, and the credential epoch",
);

let invalidScopeRejected = false;
try {
  buildScopedOfflineQueueKey({
    tenantId: "tenant_1",
    branchId: "",
    terminalId: "terminal_1",
    userId: "user_a",
    terminalCredentialVersion: 1,
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
    userId: "user_a",
    terminalCredentialVersion: 1,
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
  userId: "user_a",
  terminalCredentialVersion: 1,
};
type SmokePrintPayload = { content: string; auditReported?: boolean };
const printQueue = createScopedPrintJobQueue<SmokePrintPayload>({
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
  duplicatePrintJob.id === printJob.id &&
    (await printQueue.list()).length === 1,
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

const rotatedPrintQueueScope = {
  ...printQueueScope,
  userId: "user_b",
  terminalCredentialVersion: 9,
};
const reopenedPrintQueue = createScopedPrintJobQueue<SmokePrintPayload>({
  storage: sharedScopedStorage,
  scope: rotatedPrintQueueScope,
});
const persistedPrintJob = (await reopenedPrintQueue.list())[0];
assert(
  persistedPrintJob?.id === printJob.id &&
    persistedPrintJob.status === "failed" &&
    persistedPrintJob.lastError === "printer disconnected",
  "terminal print history must survive queue recreation, staff changes, and credential rotation",
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
const auditedPrintJob = await reopenedPrintQueue.updatePayload(
  printJob.id,
  (payload) => ({ ...payload, auditReported: true }),
);
assert(
  auditedPrintJob?.payload.auditReported === true &&
    (await reopenedPrintQueue.list())[0]?.payload.auditReported === true,
  "print job payload updates should persist audit acknowledgement metadata",
);

const uncertainPrintStorage = createMemoryStorage();
const uncertainPrintQueueKey = buildScopedPrintJobQueueKey(printQueueScope);
await uncertainPrintStorage.setItem(
  uncertainPrintQueueKey,
  JSON.stringify([
    {
      id: "uncertain_print_job",
      idempotencyKey: "uncertain_print_idempotency",
      payload: { content: "possibly printed receipt" },
      status: "printing",
      attempt: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ]),
);
const uncertainPrintQueue = createScopedPrintJobQueue<{ content: string }>({
  storage: uncertainPrintStorage,
  scope: printQueueScope,
});
let uncertainPrintExecutions = 0;
const uncertainReplay = await uncertainPrintQueue.replay(async () => {
  uncertainPrintExecutions += 1;
});
assert(
  uncertainReplay.failed?.id === "uncertain_print_job" &&
    uncertainReplay.failed.status === "printing" &&
    uncertainPrintExecutions === 0,
  "a persisted printing job has an uncertain physical outcome and must never replay automatically",
);
let uncertainRetryRejected = false;
try {
  await uncertainPrintQueue.retry("uncertain_print_job", async () => {
    uncertainPrintExecutions += 1;
  });
} catch (error) {
  uncertainRetryRejected =
    error instanceof Error && /outcome is uncertain/.test(error.message);
}
assert(
  uncertainRetryRejected && uncertainPrintExecutions === 0,
  "an uncertain print must require a separate authorized reprint",
);

const preferencesValues = new Map<string, string>();
const preferencesStorage = createPreferencesStorageAdapter({
  async get({ key }) {
    return { value: preferencesValues.get(key) ?? null };
  },
  async set({ key, value }) {
    preferencesValues.set(key, value);
  },
  async remove({ key }) {
    preferencesValues.delete(key);
  },
  async keys() {
    return { keys: [...preferencesValues.keys()] };
  },
});
await preferencesStorage.setItem("preferences_key", "preferences_value");
assert(
  (await preferencesStorage.keys?.())?.includes("preferences_key") === true,
  "the Preferences adapter should expose key enumeration when supported",
);

const parsedLegacyQueueKey = parseScopedOfflineQueueKey(
  "cleanhub.pos.offline.queue.v2:tenant_legacy:branch_legacy:terminal_legacy:epoch-1",
);
assert(
  parsedLegacyQueueKey?.userId === null &&
    parsedLegacyQueueKey.terminalCredentialVersion === 1,
  "legacy v2 queue keys without a user must remain discoverable for quarantine",
);

const recoveryStorage = createMemoryStorage();
const recoveryEpochOneScope = {
  tenantId: "tenant_recovery",
  branchId: "branch_recovery",
  terminalId: "terminal_recovery",
  userId: "user_recovery",
  terminalCredentialVersion: 1,
};
const recoveryEpochTwoScope = {
  ...recoveryEpochOneScope,
  terminalCredentialVersion: 2,
};
const recoveryEpochOneQueue = createScopedOfflineQueue({
  storage: recoveryStorage,
  scope: recoveryEpochOneScope,
});
await recoveryEpochOneQueue.enqueue({
  id: "recovery_order_operation",
  idempotencyKey: "recovery_order_idempotency",
  entity: "order",
  operation: "create",
  payload: { orderId: "order_recovery", total: "25.00" },
  metadata: {
    actorUserId: recoveryEpochOneScope.userId,
    actorRole: "cashier",
  },
});

const firstRecovery = await recoverScopedOfflineQueue({
  storage: recoveryStorage,
  scope: recoveryEpochTwoScope,
});
const recoveryEpochTwoQueue = createScopedOfflineQueue({
  storage: recoveryStorage,
  scope: recoveryEpochTwoScope,
});
const recoveredItems = await recoveryEpochTwoQueue.list<{
  orderId: string;
  total: string;
}>();
assert(
  firstRecovery.storageEnumerationSupported &&
    firstRecovery.migratedItemCount === 0 &&
    firstRecovery.migratedQueueKeys.length === 0 &&
    firstRecovery.quarantinedItemCount === 1 &&
    firstRecovery.quarantined[0]?.reasons.includes("credential_epoch_mismatch"),
  "an earlier credential epoch must be quarantined even when every identity field matches",
);
assert(
  recoveredItems.length === 0,
  "a new credential epoch must never receive old commands automatically",
);
assert(
  (await recoveryEpochOneQueue.list()).length === 1,
  "a quarantined previous-epoch command must remain intact for explicit review",
);

const repeatedRecovery = await recoverScopedOfflineQueue({
  storage: recoveryStorage,
  scope: recoveryEpochTwoScope,
});
assert(
  repeatedRecovery.migratedItemCount === 0 &&
    repeatedRecovery.quarantinedItemCount === 1 &&
    (await recoveryEpochTwoQueue.list()).length === 0 &&
    (await recoveryEpochOneQueue.list()).length === 1,
  "repeated discovery must leave quarantined commands untouched",
);

const crossBranchQueue = createScopedOfflineQueue({
  storage: recoveryStorage,
  scope: {
    ...recoveryEpochOneScope,
    branchId: "branch_other",
  },
});
const crossUserQueue = createScopedOfflineQueue({
  storage: recoveryStorage,
  scope: {
    ...recoveryEpochOneScope,
    userId: "user_other",
  },
});
const futureEpochQueue = createScopedOfflineQueue({
  storage: recoveryStorage,
  scope: {
    ...recoveryEpochOneScope,
    terminalCredentialVersion: 3,
  },
});
await Promise.all([
  crossBranchQueue.enqueue({
    id: "cross_branch_operation",
    entity: "order",
    operation: "create",
    payload: { orderId: "cross_branch_order" },
  }),
  crossUserQueue.enqueue({
    id: "cross_user_operation",
    entity: "order",
    operation: "create",
    payload: { orderId: "cross_user_order" },
  }),
  futureEpochQueue.enqueue({
    id: "future_epoch_operation",
    entity: "order",
    operation: "create",
    payload: { orderId: "future_epoch_order" },
  }),
]);
const quarantinedRecovery = await recoverScopedOfflineQueue({
  storage: recoveryStorage,
  scope: recoveryEpochTwoScope,
});
assert(
  quarantinedRecovery.migratedItemCount === 0 &&
    quarantinedRecovery.quarantinedItemCount === 4 &&
    quarantinedRecovery.quarantined.length === 4 &&
    quarantinedRecovery.quarantined.some((entry) =>
      entry.reasons.includes("branch_mismatch"),
    ) &&
    quarantinedRecovery.quarantined.some((entry) =>
      entry.reasons.includes("user_mismatch"),
    ) &&
    quarantinedRecovery.quarantined.some((entry) =>
      entry.reasons.includes("future_epoch"),
    ),
  "cross-branch, cross-user, and future-epoch writes must be reported as quarantined",
);
assert(
  (await crossBranchQueue.list()).length === 1 &&
    (await crossUserQueue.list()).length === 1 &&
    (await futureEpochQueue.list()).length === 1,
  "quarantined queues must never be replayed, migrated, or deleted automatically",
);

const nonEnumerableBackingStorage = createMemoryStorage();
const nonEnumerableStorage = {
  getItem: nonEnumerableBackingStorage.getItem,
  setItem: nonEnumerableBackingStorage.setItem,
  removeItem: nonEnumerableBackingStorage.removeItem,
};
const nonEnumerableRecovery = await recoverScopedOfflineQueue({
  storage: nonEnumerableStorage,
  scope: recoveryEpochTwoScope,
});
assert(
  !nonEnumerableRecovery.storageEnumerationSupported &&
    nonEnumerableRecovery.migratedItemCount === 0 &&
    nonEnumerableRecovery.quarantinedItemCount === 0,
  "storage without key enumeration should retain the prior behavior without error",
);

const legacyV1QueueKey =
  "cleanhub.pos.offline.queue.v1:tenant_recovery:branch_recovery:terminal_recovery";
const legacyV1Item = {
  id: "legacy_v1_operation",
  entity: "order",
  operation: "create" as const,
  payload: { orderId: "legacy_v1_order" },
  idempotencyKey: "legacy_v1_idempotency",
  status: "pending" as const,
  attempt: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
const legacyV1BackingStorage = createMemoryStorage({
  [legacyV1QueueKey]: JSON.stringify([legacyV1Item]),
});
const legacyV1NonEnumerableStorage = {
  getItem: legacyV1BackingStorage.getItem,
  setItem: legacyV1BackingStorage.setItem,
  removeItem: legacyV1BackingStorage.removeItem,
};
const legacyV1Recovery = await recoverScopedOfflineQueue({
  storage: legacyV1NonEnumerableStorage,
  scope: recoveryEpochTwoScope,
});
assert(
  !legacyV1Recovery.storageEnumerationSupported &&
    legacyV1Recovery.migratedItemCount === 0 &&
    legacyV1Recovery.quarantinedItemCount === 1 &&
    legacyV1Recovery.quarantined[0]?.queueKey === legacyV1QueueKey &&
    legacyV1Recovery.quarantined[0]?.reasons.includes(
      "legacy_scope_unattributed",
    ),
  "the deterministic legacy v1 key must be quarantined even when storage cannot enumerate keys",
);
assert(
  (await legacyV1BackingStorage.getItem(legacyV1QueueKey)) ===
    JSON.stringify([legacyV1Item]),
  "legacy v1 data must remain untouched for explicit review",
);

const concurrentRecoveryStorage = createMemoryStorage();
const concurrentRecoveryEpochOneQueue = createScopedOfflineQueue({
  storage: concurrentRecoveryStorage,
  scope: {
    ...recoveryEpochOneScope,
    tenantId: "tenant_concurrent_recovery",
  },
});
const concurrentRecoveryEpochTwoScope = {
  ...recoveryEpochTwoScope,
  tenantId: "tenant_concurrent_recovery",
};
await concurrentRecoveryEpochOneQueue.enqueue({
  id: "concurrent_recovery_operation",
  idempotencyKey: "concurrent_recovery_idempotency",
  entity: "order",
  operation: "create",
  payload: { orderId: "concurrent_recovery_order" },
});
const concurrentRecoveries = await Promise.all([
  recoverScopedOfflineQueue({
    storage: concurrentRecoveryStorage,
    scope: concurrentRecoveryEpochTwoScope,
  }),
  recoverScopedOfflineQueue({
    storage: concurrentRecoveryStorage,
    scope: concurrentRecoveryEpochTwoScope,
  }),
]);
const concurrentRecoveryEpochTwoQueue = createScopedOfflineQueue({
  storage: concurrentRecoveryStorage,
  scope: concurrentRecoveryEpochTwoScope,
});
assert(
  concurrentRecoveries.every(
    (recovery) =>
      recovery.migratedItemCount === 0 && recovery.quarantinedItemCount === 1,
  ) &&
    (await concurrentRecoveryEpochTwoQueue.list()).length === 0 &&
    (await concurrentRecoveryEpochOneQueue.list()).length === 1,
  "concurrent discovery must never migrate or delete a quarantined command",
);

const concurrentStorage = createMemoryStorage();
const concurrentScope = {
  tenantId: "tenant_concurrent",
  branchId: "branch_concurrent",
  terminalId: "terminal_concurrent",
  userId: "user_concurrent",
  terminalCredentialVersion: 1,
};
const concurrentQueueA = createScopedOfflineQueue({
  storage: concurrentStorage,
  scope: concurrentScope,
});
const concurrentQueueB = createScopedOfflineQueue({
  storage: concurrentStorage,
  scope: concurrentScope,
});
const concurrentItems = await Promise.all(
  Array.from({ length: 20 }, (_, index) =>
    (index % 2 === 0 ? concurrentQueueA : concurrentQueueB).enqueue({
      id: `offline_concurrent_${index}`,
      idempotencyKey: `offline_concurrent_key_${index}`,
      entity: "order",
      operation: "create",
      payload: { index, updates: 0 },
    }),
  ),
);
assert(
  (await concurrentQueueA.list()).length === concurrentItems.length,
  "concurrent enqueue calls from queue instances sharing a key must not overwrite each other",
);

const concurrentlyUpdatedId = concurrentItems[0]?.id;
assert(Boolean(concurrentlyUpdatedId), "a concurrent queue item should exist");
await Promise.all([
  concurrentQueueA.updatePayload<{ index: number; updates: number }>(
    concurrentlyUpdatedId,
    (payload) => ({ ...payload, updates: payload.updates + 1 }),
  ),
  concurrentQueueB.updatePayload<{ index: number; updates: number }>(
    concurrentlyUpdatedId,
    (payload) => ({ ...payload, updates: payload.updates + 1 }),
  ),
]);
const concurrentlyUpdated = (
  await concurrentQueueA.list<{
    index: number;
    updates: number;
  }>()
).find((item) => item.id === concurrentlyUpdatedId);
assert(
  concurrentlyUpdated?.payload.updates === 2,
  "concurrent payload updates must each observe the latest persisted queue state",
);

const offlineReplayCounts = new Map<string, number>();
const replayHandler = async (item: { id: string }) => {
  offlineReplayCounts.set(item.id, (offlineReplayCounts.get(item.id) ?? 0) + 1);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1);
  });
};
await Promise.all([
  concurrentQueueA.replay(replayHandler),
  concurrentQueueB.replay(replayHandler),
]);
assert(
  offlineReplayCounts.size === concurrentItems.length &&
    [...offlineReplayCounts.values()].every((count) => count === 1) &&
    (await concurrentQueueA.list()).length === 0,
  "concurrent replay calls sharing a key must execute every offline item exactly once",
);

const concurrentPrintQueueA = createScopedPrintJobQueue<{ index: number }>({
  storage: concurrentStorage,
  scope: concurrentScope,
  namespace: "cleanhub.pos.concurrent.print.smoke",
});
const concurrentPrintQueueB = createScopedPrintJobQueue<{ index: number }>({
  storage: concurrentStorage,
  scope: concurrentScope,
  namespace: "cleanhub.pos.concurrent.print.smoke",
});
const concurrentPrintJobs = await Promise.all(
  Array.from({ length: 12 }, (_, index) =>
    (index % 2 === 0 ? concurrentPrintQueueA : concurrentPrintQueueB).enqueue({
      id: `print_concurrent_${index}`,
      idempotencyKey: `print_concurrent_key_${index}`,
      payload: { index },
    }),
  ),
);
assert(
  (await concurrentPrintQueueA.list()).length === concurrentPrintJobs.length,
  "concurrent print enqueue calls from queue instances sharing a key must not overwrite each other",
);

const printExecutionCounts = new Map<string, number>();
const printHandler = async (job: { id: string }) => {
  printExecutionCounts.set(job.id, (printExecutionCounts.get(job.id) ?? 0) + 1);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1);
  });
};
const firstConcurrentPrintJob = concurrentPrintJobs[0];
assert(Boolean(firstConcurrentPrintJob), "a concurrent print job should exist");
await Promise.all([
  concurrentPrintQueueA.retry(firstConcurrentPrintJob.id, printHandler),
  concurrentPrintQueueB.retry(firstConcurrentPrintJob.id, printHandler),
]);
await Promise.all([
  concurrentPrintQueueA.replay(printHandler),
  concurrentPrintQueueB.replay(printHandler),
]);
assert(
  printExecutionCounts.size === concurrentPrintJobs.length &&
    [...printExecutionCounts.values()].every((count) => count === 1),
  "concurrent print retry and replay calls sharing a key must execute every physical job exactly once",
);

const originalNavigatorLocksDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "locks",
);
const browserLockTails = new Map<string, Promise<void>>();
const requestedBrowserLockNames: string[] = [];
const fakeBrowserLocks = {
  async query() {
    return { held: [], pending: [] };
  },
  async request<TResult>(
    name: string,
    optionsOrCallback: LockGrantedCallback<TResult> | LockOptions,
    optionalCallback?: LockGrantedCallback<TResult>,
  ): Promise<TResult> {
    const callback =
      typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : optionalCallback;
    assert(Boolean(callback), "a Web Lock callback must be supplied");
    requestedBrowserLockNames.push(name);

    const previous = browserLockTails.get(name) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(
      () => gate,
      () => gate,
    );
    browserLockTails.set(name, tail);
    await previous.catch(() => undefined);

    try {
      return await callback!(null);
    } finally {
      release();
      if (browserLockTails.get(name) === tail) {
        browserLockTails.delete(name);
      }
    }
  },
} as LockManager;

Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: fakeBrowserLocks,
});

try {
  const firstRealmUrl = new URL(
    "./index.ts?offline-realm=first",
    import.meta.url,
  );
  const secondRealmUrl = new URL(
    "./index.ts?offline-realm=second",
    import.meta.url,
  );
  const firstRealm = (await import(
    firstRealmUrl.href
  )) as typeof import("./index.js");
  const secondRealm = (await import(
    secondRealmUrl.href
  )) as typeof import("./index.js");
  let crossRealmValue: string | null = null;
  const crossRealmStorage = {
    async getItem() {
      const snapshot = crossRealmValue;
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      return snapshot;
    },
    async setItem(_key: string, value: string) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      crossRealmValue = value;
    },
    async removeItem() {
      crossRealmValue = null;
    },
  };
  const crossRealmScope = {
    tenantId: "tenant_cross_realm_private",
    branchId: "branch_cross_realm",
    terminalId: "terminal_cross_realm",
    userId: "user_cross_realm",
    terminalCredentialVersion: 1,
  };
  const firstRealmQueue = firstRealm.createScopedOfflineQueue({
    storage: crossRealmStorage,
    scope: crossRealmScope,
  });
  const secondRealmQueue = secondRealm.createScopedOfflineQueue({
    storage: crossRealmStorage,
    scope: crossRealmScope,
  });
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      (index % 2 === 0 ? firstRealmQueue : secondRealmQueue).enqueue({
        id: `cross_realm_${index}`,
        idempotencyKey: `cross_realm_idempotency_${index}`,
        entity: "order",
        operation: "create",
        payload: { index },
      }),
    ),
  );
  assert(
    (await firstRealmQueue.list()).length === 20,
    "Web Locks must serialize read-modify-write queue operations across JavaScript realms",
  );

  crossRealmValue = null;
  const firstRealmPrintQueue = firstRealm.createScopedPrintJobQueue<{
    content: string;
  }>({
    storage: crossRealmStorage,
    scope: crossRealmScope,
  });
  const secondRealmPrintQueue = secondRealm.createScopedPrintJobQueue<{
    content: string;
  }>({
    storage: crossRealmStorage,
    scope: crossRealmScope,
  });
  const crossRealmPrintJob = await firstRealmPrintQueue.enqueue({
    id: "cross_realm_print",
    idempotencyKey: "cross_realm_print_idempotency",
    payload: { content: "one physical receipt" },
  });
  let crossRealmPrintExecutions = 0;
  const crossRealmPrintHandler = async () => {
    crossRealmPrintExecutions += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
  };
  await Promise.all([
    firstRealmPrintQueue.retry(crossRealmPrintJob.id, crossRealmPrintHandler),
    secondRealmPrintQueue.retry(crossRealmPrintJob.id, crossRealmPrintHandler),
  ]);
  assert(
    crossRealmPrintExecutions === 1,
    "the replay Web Lock must prevent duplicate physical printing across JavaScript realms",
  );
  assert(
    requestedBrowserLockNames.length > 0 &&
      requestedBrowserLockNames.every(
        (name) =>
          name.startsWith("cleanhub-pos-offline-") &&
          !name.includes(crossRealmScope.tenantId),
      ),
    "Web Lock names must use a fixed prefix without exposing tenant identifiers",
  );
} finally {
  if (originalNavigatorLocksDescriptor) {
    Object.defineProperty(navigator, "locks", originalNavigatorLocksDescriptor);
  } else {
    delete (navigator as unknown as { locks?: LockManager }).locks;
  }
}

console.log("offline smoke ok");
