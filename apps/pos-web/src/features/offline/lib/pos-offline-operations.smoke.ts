import { createId } from "@cleanhub/id";
import {
  createMemoryStorage,
  createScopedOfflineQueue,
} from "@cleanhub/offline";

import {
  createCustomerAccountOfflineMutation,
  createOrderOfflineMutation,
  createOrderStatusOfflineMutation,
  createTicketStatusOfflineMutation,
  replayPosOfflineQueueItem,
  type PosOfflineReplayApi,
} from "./pos-offline-operations";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const customerId = createId();
  const serviceId = createId();
  const ticketId = createId();
  const orderId = createId();
  const accountMutation = createCustomerAccountOfflineMutation({
    accountName: "Offline Customer",
    phone: "+221700000001",
  });
  const manualOrderMutation = createOrderOfflineMutation({
    orderType: "manual",
    branchId: createId(),
    customerId,
    items: [{ serviceId, quantity: "1" }],
  });
  const ticketOrderMutation = createOrderOfflineMutation({
    orderType: "ticket",
    ticketId,
  });
  const orderStatusMutation = createOrderStatusOfflineMutation(orderId, {
    to: "received",
    version: 1,
  });
  const ticketStatusMutation = createTicketStatusOfflineMutation(ticketId, {
    to: "pending",
    version: 1,
  });

  for (const mutation of [
    accountMutation,
    manualOrderMutation,
    ticketOrderMutation,
    orderStatusMutation,
    ticketStatusMutation,
  ]) {
    assert(mutation.id.length === 26, "offline operation id must be a ULID");
    assert(
      mutation.idempotencyKey.length === 26,
      "offline idempotency key must be a ULID",
    );
  }
  assert(
    accountMutation.payload.input.id === accountMutation.entityId,
    "customer replay must retain its stable entity id",
  );
  assert(
    manualOrderMutation.payload.input.id === manualOrderMutation.entityId &&
      ticketOrderMutation.payload.input.id === ticketOrderMutation.entityId,
    "manual and ticket orders must retain stable entity ids",
  );

  const queue = createScopedOfflineQueue({
    storage: createMemoryStorage(),
    scope: {
      tenantId: createId(),
      branchId: createId(),
      terminalId: createId(),
    },
  });
  for (const mutation of [
    accountMutation,
    manualOrderMutation,
    ticketOrderMutation,
    orderStatusMutation,
    ticketStatusMutation,
  ]) {
    await queue.enqueue(mutation as import("@cleanhub/offline").EnqueueInput);
  }

  const calls: Array<{
    kind: string;
    entityId: string;
    operationId: string | undefined;
    idempotencyKey: string | undefined;
  }> = [];
  const api: PosOfflineReplayApi = {
    async createCustomerAccount(input, options) {
      calls.push({
        kind: "customer",
        entityId: input.id,
        operationId: options.requestId,
        idempotencyKey: options.idempotencyKey,
      });
    },
    async createOrder(input, options) {
      calls.push({
        kind: input.orderType,
        entityId: input.id,
        operationId: options.requestId,
        idempotencyKey: options.idempotencyKey,
      });
    },
    async changeOrderStatus(replayedOrderId, _input, options) {
      calls.push({
        kind: "order-status",
        entityId: replayedOrderId,
        operationId: options.requestId,
        idempotencyKey: options.idempotencyKey,
      });
    },
    async changeTicketStatus(replayedTicketId, _input, options) {
      calls.push({
        kind: "ticket-status",
        entityId: replayedTicketId,
        operationId: options.requestId,
        idempotencyKey: options.idempotencyKey,
      });
    },
  };

  const replay = await queue.replay((item) =>
    replayPosOfflineQueueItem(item, api),
  );
  assert(!replay.failed, "all eligible POS writes should replay");
  assert(
    calls.length === 5,
    "every eligible POS write should use an API method",
  );
  assert(
    calls.every(
      (call) =>
        call.operationId?.length === 26 && call.idempotencyKey?.length === 26,
    ),
    "replay must forward stable operation and idempotency identifiers",
  );
  assert(
    (await queue.list()).length === 0,
    "successful replay should drain queue",
  );

  console.log("POS offline operations smoke ok");
}

void main();
