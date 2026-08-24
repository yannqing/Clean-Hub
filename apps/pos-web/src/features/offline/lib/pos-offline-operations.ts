import {
  type ApiRequestOptions,
  type ChangePosOrderStatusRequest,
  type ChangeServiceTicketStatusRequest,
  type CreatePosCheckoutRequest,
  type CreatePosCheckoutResponse,
  type CreatePosAccountRequest,
  type CreatePosProfileRequest,
  type CreatePosOrderRequest,
  type CreatePosPaymentRequest,
  type CreatePosPaymentResponse,
  type PosCustomerAccountDetail,
  type PosCustomerProfileSummary,
  type PosCustomerProfileWithAccount,
  type PosOrderDetail,
  type ServiceTicketDetail,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import type { EnqueueInput, OfflineQueueItem } from "@cleanhub/offline";

export const POS_OFFLINE_ENTITIES = {
  customerAccountCreate: "pos.customer-account.create",
  customerProfileCreate: "pos.customer-profile.create",
  orderCreate: "pos.order.create",
  orderCheckout: "pos.order.checkout",
  orderPaymentCreate: "pos.order.payment.create",
  orderStatusChange: "pos.order.status-change",
  ticketStatusChange: "pos.service-ticket.status-change",
} as const;

export type PosOfflineQueueSummary = {
  pendingOperationsCount: number;
  pendingSalesCount: number;
  oldestPendingAt: string | null;
};

export function summarizePosOfflineQueueItems(
  items: readonly OfflineQueueItem[],
): PosOfflineQueueSummary {
  const pendingItems = items.filter((item) => item.status === "pending");
  const saleIds = new Set<string>();

  for (const item of pendingItems) {
    if (
      item.entity !== POS_OFFLINE_ENTITIES.orderCreate &&
      item.entity !== POS_OFFLINE_ENTITIES.orderCheckout &&
      item.entity !== POS_OFFLINE_ENTITIES.orderPaymentCreate
    ) {
      continue;
    }

    const entityId = item.metadata?.entityId;
    if (typeof entityId === "string" && entityId) saleIds.add(entityId);
  }

  const oldestPendingAt = pendingItems.reduce<string | null>(
    (oldest, item) =>
      !oldest || Date.parse(item.createdAt) < Date.parse(oldest)
        ? item.createdAt
        : oldest,
    null,
  );

  return {
    pendingOperationsCount: pendingItems.length,
    pendingSalesCount: saleIds.size,
    oldestPendingAt,
  };
}

type StableCreatePosAccountRequest = CreatePosAccountRequest & { id: string };
type StableCreatePosProfileRequest = CreatePosProfileRequest & { id: string };
type StableCreatePosOrderRequest = CreatePosOrderRequest & { id: string };
type StableCreatePosCheckoutRequest = Omit<
  CreatePosCheckoutRequest,
  "order"
> & {
  order: StableCreatePosOrderRequest;
};

type CustomerAccountCreatePayload = {
  input: StableCreatePosAccountRequest;
};

export type PosOfflineCustomerAccountSnapshot = {
  accountName: string;
  phone: string | null;
  email: string | null;
};

export type PosQueuedCustomerAccount = PosOfflineCustomerAccountSnapshot & {
  id: string;
  operationId: string;
  createdAt: string;
  syncState: "pending" | "failed";
  lastError?: string;
};

type CustomerProfileCreatePayload = {
  accountId: string;
  account: PosOfflineCustomerAccountSnapshot;
  input: StableCreatePosProfileRequest;
};

type OrderCreatePayload = {
  input: StableCreatePosOrderRequest;
};

type OrderCheckoutPayload = {
  input: StableCreatePosCheckoutRequest;
};

// The payment body keeps its own idempotencyKey; it is generated once at
// enqueue time and must be replayed unchanged so the backend can dedupe.
export type OrderPaymentCreatePayload = {
  orderId: string;
  input: CreatePosPaymentRequest;
};

type OrderStatusChangePayload = {
  orderId: string;
  input: ChangePosOrderStatusRequest;
};

type TicketStatusChangePayload = {
  ticketId: string;
  input: ChangeServiceTicketStatusRequest;
};

export type PosOfflinePayload =
  | CustomerAccountCreatePayload
  | CustomerProfileCreatePayload
  | OrderCreatePayload
  | OrderCheckoutPayload
  | OrderPaymentCreatePayload
  | OrderStatusChangePayload
  | TicketStatusChangePayload;

export type PosOfflineMutation<TPayload extends PosOfflinePayload> = Omit<
  EnqueueInput<TPayload>,
  "metadata"
> & {
    id: string;
    idempotencyKey: string;
    entityId: string;
    metadata: {
      entityId: string;
      dependsOnOperationIds: string[];
    };
  };

type ReplayRequestOptions = Pick<
  ApiRequestOptions,
  "idempotencyKey" | "requestId"
>;

export type PosOfflineReplayApi = {
  createCustomerAccount(
    input: StableCreatePosAccountRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  createCustomerProfile(
    accountId: string,
    input: StableCreatePosProfileRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  createOrder(
    input: StableCreatePosOrderRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  checkoutOrder(
    input: StableCreatePosCheckoutRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  payOrder(
    orderId: string,
    input: CreatePosPaymentRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  changeOrderStatus(
    orderId: string,
    input: ChangePosOrderStatusRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
  changeTicketStatus(
    ticketId: string,
    input: ChangeServiceTicketStatusRequest,
    options: ReplayRequestOptions,
  ): Promise<unknown>;
};

export function createCustomerAccountOfflineMutation(
  input: CreatePosAccountRequest,
): PosOfflineMutation<CustomerAccountCreatePayload> {
  const entityId = input.id ?? createId();
  return createMutation(POS_OFFLINE_ENTITIES.customerAccountCreate, entityId, {
    input: { ...input, id: entityId },
  });
}

export function createCustomerProfileOfflineMutation(
  accountId: string,
  input: CreatePosProfileRequest,
  account: PosOfflineCustomerAccountSnapshot,
  dependsOnOperationIds: readonly string[] = [],
): PosOfflineMutation<CustomerProfileCreatePayload> {
  const entityId = input.id ?? createId();
  return createMutation(
    POS_OFFLINE_ENTITIES.customerProfileCreate,
    entityId,
    {
      accountId,
      account,
      input: { ...input, id: entityId },
    },
    dependsOnOperationIds,
  );
}

export function createOrderOfflineMutation(
  input: CreatePosOrderRequest,
  dependsOnOperationIds: readonly string[] = [],
): PosOfflineMutation<OrderCreatePayload> {
  const entityId = input.id ?? createId();
  return createMutation(
    POS_OFFLINE_ENTITIES.orderCreate,
    entityId,
    {
      input: { ...input, id: entityId },
    },
    dependsOnOperationIds,
  );
}

export function createOrderCheckoutOfflineMutation(
  input: CreatePosCheckoutRequest,
  dependsOnOperationIds: readonly string[] = [],
): PosOfflineMutation<OrderCheckoutPayload> {
  const entityId = input.order.id ?? createId();
  return createMutation(
    POS_OFFLINE_ENTITIES.orderCheckout,
    entityId,
    {
      input: {
        ...input,
        order: { ...input.order, id: entityId },
      },
    },
    dependsOnOperationIds,
    input.payment?.idempotencyKey ?? entityId,
  );
}

export function createOrderPaymentOfflineMutation(
  orderId: string,
  input: CreatePosPaymentRequest,
  dependsOnOperationIds: readonly string[] = [],
): PosOfflineMutation<OrderPaymentCreatePayload> {
  // Reuse the payment body's idempotency key as the queue key so a duplicate
  // enqueue collapses into one item and replay always resends the same key.
  return createMutation(
    POS_OFFLINE_ENTITIES.orderPaymentCreate,
    orderId,
    {
      orderId,
      input,
    },
    dependsOnOperationIds,
    input.idempotencyKey,
  );
}

export function createOrderStatusOfflineMutation(
  orderId: string,
  input: ChangePosOrderStatusRequest,
): PosOfflineMutation<OrderStatusChangePayload> {
  return createMutation(POS_OFFLINE_ENTITIES.orderStatusChange, orderId, {
    orderId,
    input,
  });
}

export function createTicketStatusOfflineMutation(
  ticketId: string,
  input: ChangeServiceTicketStatusRequest,
): PosOfflineMutation<TicketStatusChangePayload> {
  return createMutation(POS_OFFLINE_ENTITIES.ticketStatusChange, ticketId, {
    ticketId,
    input,
  });
}

export async function replayPosOfflineQueueItem(
  item: OfflineQueueItem,
  api: PosOfflineReplayApi,
): Promise<void> {
  const options: ReplayRequestOptions = {
    idempotencyKey: item.idempotencyKey,
    requestId: item.id,
  };

  switch (item.entity) {
    case POS_OFFLINE_ENTITIES.customerAccountCreate: {
      const payload = item.payload as CustomerAccountCreatePayload;
      await api.createCustomerAccount(payload.input, options);
      return;
    }
    case POS_OFFLINE_ENTITIES.customerProfileCreate: {
      const payload = item.payload as CustomerProfileCreatePayload;
      await api.createCustomerProfile(
        payload.accountId,
        payload.input,
        options,
      );
      return;
    }
    case POS_OFFLINE_ENTITIES.orderCreate: {
      const payload = item.payload as OrderCreatePayload;
      await api.createOrder(payload.input, options);
      return;
    }
    case POS_OFFLINE_ENTITIES.orderCheckout: {
      const payload = item.payload as OrderCheckoutPayload;
      await api.checkoutOrder(payload.input, options);
      return;
    }
    case POS_OFFLINE_ENTITIES.orderPaymentCreate: {
      if (!isPosOrderPaymentCreateQueueItem(item)) {
        throw new Error(
          "The queued POS payment payload is invalid and cannot be replayed.",
        );
      }
      await api.payOrder(item.payload.orderId, item.payload.input, options);
      return;
    }
    case POS_OFFLINE_ENTITIES.orderStatusChange: {
      const payload = item.payload as OrderStatusChangePayload;
      await api.changeOrderStatus(payload.orderId, payload.input, options);
      return;
    }
    case POS_OFFLINE_ENTITIES.ticketStatusChange: {
      const payload = item.payload as TicketStatusChangePayload;
      await api.changeTicketStatus(payload.ticketId, payload.input, options);
      return;
    }
    default:
      throw new Error(
        `No POS offline replay handler is registered for ${item.entity}.`,
      );
  }
}

export type PosOfflineCustomerAccountResult =
  | { queued: false; data: PosCustomerAccountDetail }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineCustomerProfileResult =
  | { queued: false; data: PosCustomerProfileSummary }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineOrderResult =
  | { queued: false; data: PosOrderDetail }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineCheckoutResult =
  | { queued: false; data: CreatePosCheckoutResponse }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineOrderPaymentResult =
  | { queued: false; data: CreatePosPaymentResponse | undefined }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineOrderStatusResult =
  | { queued: false; data: PosOrderDetail }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineTicketStatusResult =
  | { queued: false; data: ServiceTicketDetail }
  | { queued: true; entityId: string; operationId: string };

export function getQueuedPosCustomerProfiles(
  items: OfflineQueueItem[],
): PosCustomerProfileWithAccount[] {
  return items.flatMap((item) => {
    if (
      item.status !== "pending" ||
      item.entity !== POS_OFFLINE_ENTITIES.customerProfileCreate ||
      isPosOfflineQueueItemBlocked(item, items)
    ) {
      return [];
    }

    const payload = item.payload as CustomerProfileCreatePayload;
    return [
      {
        id: payload.input.id,
        customerAccountId: payload.accountId,
        accountName: payload.account.accountName,
        fullName: payload.input.fullName,
        phone: payload.input.phone ?? null,
        email: payload.input.email ?? null,
        status: "active" as const,
        createdAt: item.createdAt,
      },
    ];
  });
}

export function getQueuedPosCustomerAccounts(
  items: OfflineQueueItem[],
): PosQueuedCustomerAccount[] {
  return items.flatMap((item) => {
    if (
      item.status !== "pending" ||
      item.entity !== POS_OFFLINE_ENTITIES.customerAccountCreate
    ) {
      return [];
    }

    const payload = item.payload as CustomerAccountCreatePayload;
    const blocked = isPosOfflineQueueItemBlocked(item, items);
    return [
      {
        id: payload.input.id,
        operationId: item.id,
        accountName: payload.input.accountName,
        phone: payload.input.phone ?? null,
        email: payload.input.email ?? null,
        createdAt: item.createdAt,
        syncState: blocked ? ("failed" as const) : ("pending" as const),
        ...(item.lastError ? { lastError: item.lastError } : {}),
      },
    ];
  });
}

export type PosOfflineCreateDependency = {
  operationId: string;
  blocked: boolean;
  lastError?: string;
};

export function findQueuedPosCreateDependency(
  items: OfflineQueueItem[],
  entity: (typeof POS_OFFLINE_ENTITIES)[
    | "customerAccountCreate"
    | "customerProfileCreate"
    | "orderCreate"
    | "orderCheckout"],
  entityId: string,
): PosOfflineCreateDependency | undefined {
  const item = items.find(
    (candidate) =>
      candidate.status === "pending" &&
      candidate.entity === entity &&
      candidate.metadata?.entityId === entityId,
  );

  if (!item) {
    return undefined;
  }

  const blockingItem = findBlockingPosOfflineQueueItem(item, items);
  return {
    operationId: item.id,
    blocked: Boolean(blockingItem),
    ...(blockingItem?.lastError
      ? { lastError: blockingItem.lastError }
      : {}),
  };
}

export type PosOfflineDependencyState = {
  pendingOperationIds: string[];
  blockedOperationId?: string;
  lastError?: string;
};

export function resolvePosOfflineDependencyState(
  items: OfflineQueueItem[],
  dependsOnOperationIds: readonly string[],
): PosOfflineDependencyState {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const pendingItems = dependsOnOperationIds.flatMap((operationId) => {
    const item = itemById.get(operationId);
    return item?.status === "pending" ? [item] : [];
  });

  for (const item of pendingItems) {
    const blockingItem = findBlockingPosOfflineQueueItem(item, items);
    if (blockingItem) {
      return {
        pendingOperationIds: pendingItems.map((candidate) => candidate.id),
        blockedOperationId: blockingItem.id,
        ...(blockingItem.lastError
          ? { lastError: blockingItem.lastError }
          : {}),
      };
    }
  }

  return {
    pendingOperationIds: pendingItems.map((item) => item.id),
  };
}

export function isPosOrderPaymentCreateQueueItem(
  item: OfflineQueueItem,
): item is OfflineQueueItem & { payload: OrderPaymentCreatePayload } {
  if (item.entity !== POS_OFFLINE_ENTITIES.orderPaymentCreate) {
    return false;
  }

  // Payments move money, so a corrupted persisted payload must be rejected
  // instead of being replayed with missing idempotency information.
  const payload = item.payload as
    | Partial<OrderPaymentCreatePayload>
    | undefined;
  const input = payload?.input;
  if (
    typeof payload?.orderId !== "string" ||
    typeof input?.amount !== "string" ||
    typeof input.idempotencyKey !== "string"
  ) {
    return false;
  }

  if (input.paymentMethod === "cash") {
    return true;
  }
  return (
    input.paymentMethod === "app" &&
    (input.provider === "wave" || input.provider === "orange_money") &&
    typeof input.externalReference === "string"
  );
}

function isPosOfflineQueueItemBlocked(
  item: OfflineQueueItem,
  items: OfflineQueueItem[],
): boolean {
  return Boolean(findBlockingPosOfflineQueueItem(item, items));
}

function findBlockingPosOfflineQueueItem(
  item: OfflineQueueItem,
  items: OfflineQueueItem[],
  visited = new Set<string>(),
): OfflineQueueItem | undefined {
  if (item.lastError) {
    return item;
  }
  if (visited.has(item.id)) {
    return item;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(item.id);
  const itemById = new Map(items.map((candidate) => [candidate.id, candidate]));
  for (const operationId of readDependsOnOperationIds(item)) {
    const parent = itemById.get(operationId);
    if (!parent || parent.status !== "pending") {
      continue;
    }

    const blockingItem = findBlockingPosOfflineQueueItem(
      parent,
      items,
      nextVisited,
    );
    if (blockingItem) {
      return blockingItem;
    }
  }

  return undefined;
}

function readDependsOnOperationIds(item: OfflineQueueItem): string[] {
  const value = item.metadata?.dependsOnOperationIds;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function createMutation<TPayload extends PosOfflinePayload>(
  entity: string,
  entityId: string,
  payload: TPayload,
  dependsOnOperationIds: readonly string[] = [],
  idempotencyKey: string = createId(),
): PosOfflineMutation<TPayload> {
  const operationId = createId();
  return {
    entity,
    entityId,
    operation: entity.endsWith(".create") ? "create" : "update",
    payload,
    id: operationId,
    idempotencyKey,
    metadata: {
      entityId,
      dependsOnOperationIds: [...new Set(dependsOnOperationIds)],
    },
  };
}
