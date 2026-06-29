import {
  createDeliveryTaskCache,
  createMemoryStorage,
  createOfflineQueue,
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

console.log("offline smoke ok");
