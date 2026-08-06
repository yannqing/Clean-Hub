import { createId } from "@cleanhub/id";
import {
  createMemoryStorage,
  createScopedOfflineQueue,
} from "@cleanhub/offline";

import {
  createCustomerAccountOfflineMutation,
  createCustomerProfileOfflineMutation,
  createOrderOfflineMutation,
  createOrderPaymentOfflineMutation,
  createOrderStatusOfflineMutation,
  createTicketStatusOfflineMutation,
  findQueuedPosCreateDependency,
  getQueuedPosCustomerAccounts,
  getQueuedPosCustomerProfiles,
  isPosOrderPaymentCreateQueueItem,
  POS_OFFLINE_ENTITIES,
  replayPosOfflineQueueItem,
  resolvePosOfflineDependencyState,
  type PosOfflineReplayApi,
} from "./pos-offline-operations";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const serviceId = createId();
  const ticketId = createId();
  const orderId = createId();
  const accountMutation = createCustomerAccountOfflineMutation({
    accountName: "Offline Customer",
    phone: "+221700000001",
  });
  const profileMutation = createCustomerProfileOfflineMutation(
    accountMutation.entityId,
    {
      fullName: "Offline Profile",
      phone: "+221700000001",
    },
    {
      accountName: "Offline Customer",
      phone: "+221700000001",
      email: null,
    },
    [accountMutation.id],
  );
  const manualOrderMutation = createOrderOfflineMutation(
    {
      orderType: "manual",
      branchId: createId(),
      customerId: profileMutation.entityId,
      items: [{ serviceId, quantity: "1" }],
    },
    [profileMutation.id],
  );
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
  const paymentIdempotencyKey = createId();
  const paymentMutation = createOrderPaymentOfflineMutation(
    manualOrderMutation.entityId,
    {
      paymentMethod: "cash",
      amount: "1500.00",
      idempotencyKey: paymentIdempotencyKey,
    },
    [manualOrderMutation.id],
  );

  for (const mutation of [
    accountMutation,
    profileMutation,
    manualOrderMutation,
    ticketOrderMutation,
    orderStatusMutation,
    ticketStatusMutation,
    paymentMutation,
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
    profileMutation.payload.input.id === profileMutation.entityId,
    "customer profile replay must retain its stable entity id",
  );
  assert(
    manualOrderMutation.payload.input.id === manualOrderMutation.entityId &&
      ticketOrderMutation.payload.input.id === ticketOrderMutation.entityId,
    "manual and ticket orders must retain stable entity ids",
  );
  assert(
    accountMutation.metadata.dependsOnOperationIds.length === 0 &&
      profileMutation.metadata.dependsOnOperationIds[0] ===
        accountMutation.id &&
      manualOrderMutation.metadata.dependsOnOperationIds[0] ===
        profileMutation.id &&
      ticketOrderMutation.metadata.dependsOnOperationIds.length === 0,
    "account, profile, and order mutations must persist explicit dependencies",
  );
  assert(
    paymentMutation.payload.orderId === manualOrderMutation.entityId &&
      paymentMutation.payload.input.idempotencyKey === paymentIdempotencyKey &&
      paymentMutation.idempotencyKey === paymentIdempotencyKey,
    "payment mutations must persist the idempotency key captured at enqueue time",
  );
  assert(
    paymentMutation.metadata.dependsOnOperationIds[0] ===
      manualOrderMutation.id,
    "payments for offline-created orders must depend on the order create operation",
  );

  const queue = createScopedOfflineQueue({
    storage: createMemoryStorage(),
    scope: {
      tenantId: createId(),
      branchId: createId(),
      terminalId: createId(),
      userId: createId(),
      terminalCredentialVersion: 1,
    },
  });
  for (const mutation of [
    accountMutation,
    profileMutation,
    manualOrderMutation,
    ticketOrderMutation,
    orderStatusMutation,
    ticketStatusMutation,
    paymentMutation,
  ]) {
    await queue.enqueue(mutation as import("@cleanhub/offline").EnqueueInput);
  }
  const queuedItems = await queue.list();
  const queuedPayment = queuedItems.find(
    (item) => item.entity === POS_OFFLINE_ENTITIES.orderPaymentCreate,
  );
  assert(
    queuedPayment !== undefined &&
      isPosOrderPaymentCreateQueueItem(queuedPayment),
    "a persisted payment payload must survive the queue round-trip",
  );
  assert(
    !isPosOrderPaymentCreateQueueItem({
      ...queuedPayment,
      payload: { orderId: queuedPayment.payload.orderId },
    } as typeof queuedPayment),
    "a payment payload missing its idempotency key must be rejected",
  );
  const queuedAccounts = getQueuedPosCustomerAccounts(queuedItems);
  assert(
    queuedAccounts.length === 1 &&
      queuedAccounts[0]?.id === accountMutation.entityId &&
      queuedAccounts[0]?.syncState === "pending",
    "queued customer accounts must remain searchable after a reload",
  );
  const queuedAccountDependency = findQueuedPosCreateDependency(
    queuedItems,
    POS_OFFLINE_ENTITIES.customerAccountCreate,
    accountMutation.entityId,
  );
  assert(
    queuedAccountDependency?.operationId === accountMutation.id &&
      !queuedAccountDependency.blocked,
    "a queued account must resolve to its pending create operation",
  );
  const profileDependencyState = resolvePosOfflineDependencyState(
    queuedItems,
    profileMutation.metadata.dependsOnOperationIds,
  );
  assert(
    profileDependencyState.pendingOperationIds[0] === accountMutation.id &&
      !profileDependencyState.blockedOperationId,
    "pending parents must force dependent writes into the queue",
  );
  const queuedProfiles = getQueuedPosCustomerProfiles(queuedItems);
  assert(
    queuedProfiles.length === 1 &&
      queuedProfiles[0]?.id === profileMutation.entityId &&
      queuedProfiles[0]?.accountName === "Offline Customer",
    "queued profiles must remain selectable while offline",
  );

  const failedQueue = createScopedOfflineQueue({
    storage: createMemoryStorage(),
    scope: {
      tenantId: createId(),
      branchId: createId(),
      terminalId: createId(),
      userId: createId(),
      terminalCredentialVersion: 1,
    },
  });
  await failedQueue.enqueue(accountMutation);
  await failedQueue.enqueue(profileMutation);
  const failedReplay = await failedQueue.replay(async () => {
    throw new Error("account requires manual recovery");
  });
  assert(
    Boolean(failedReplay.failed),
    "the parent operation must record replay errors",
  );
  const failedItems = await failedQueue.list();
  assert(
    getQueuedPosCustomerAccounts(failedItems)[0]?.syncState === "failed",
    "failed queued accounts must expose a blocked local read state",
  );
  assert(
    getQueuedPosCustomerProfiles(failedItems).length === 0,
    "profiles with failed queued ancestors must not be selectable",
  );
  const failedProfileDependency = resolvePosOfflineDependencyState(
    failedItems,
    profileMutation.metadata.dependsOnOperationIds,
  );
  assert(
    failedProfileDependency.blockedOperationId === accountMutation.id &&
      failedProfileDependency.lastError === "account requires manual recovery",
    "failed parents must block downstream writes with the original error",
  );

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
    async createCustomerProfile(_accountId, input, options) {
      calls.push({
        kind: "customer-profile",
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
    async payOrder(replayedOrderId, input, options) {
      calls.push({
        kind: `order-payment:${input.idempotencyKey}`,
        entityId: replayedOrderId,
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
    calls.length === 7,
    "every eligible POS write should use an API method",
  );
  assert(
    calls.some((call) => call.kind === `order-payment:${paymentIdempotencyKey}`),
    "replay must resend the enqueued payment idempotency key unchanged",
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
