import {
  type ApiRequestOptions,
  type ChangePosOrderStatusRequest,
  type ChangeServiceTicketStatusRequest,
  type CreatePosAccountRequest,
  type CreatePosOrderRequest,
  type PosCustomerAccountDetail,
  type PosOrderDetail,
  type ServiceTicketDetail,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import type { EnqueueInput, OfflineQueueItem } from "@cleanhub/offline";

export const POS_OFFLINE_ENTITIES = {
  customerAccountCreate: "pos.customer-account.create",
  orderCreate: "pos.order.create",
  orderStatusChange: "pos.order.status-change",
  ticketStatusChange: "pos.service-ticket.status-change",
} as const;

type StableCreatePosAccountRequest = CreatePosAccountRequest & { id: string };
type StableCreatePosOrderRequest = CreatePosOrderRequest & { id: string };

type CustomerAccountCreatePayload = {
  input: StableCreatePosAccountRequest;
};

type OrderCreatePayload = {
  input: StableCreatePosOrderRequest;
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
  | OrderCreatePayload
  | OrderStatusChangePayload
  | TicketStatusChangePayload;

export type PosOfflineMutation<TPayload extends PosOfflinePayload> =
  EnqueueInput<TPayload> & {
    id: string;
    idempotencyKey: string;
    entityId: string;
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
  createOrder(
    input: StableCreatePosOrderRequest,
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

export function createOrderOfflineMutation(
  input: CreatePosOrderRequest,
): PosOfflineMutation<OrderCreatePayload> {
  const entityId = input.id ?? createId();
  return createMutation(POS_OFFLINE_ENTITIES.orderCreate, entityId, {
    input: { ...input, id: entityId },
  });
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
    case POS_OFFLINE_ENTITIES.orderCreate: {
      const payload = item.payload as OrderCreatePayload;
      await api.createOrder(payload.input, options);
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

export type PosOfflineOrderResult =
  | { queued: false; data: PosOrderDetail }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineOrderStatusResult =
  | { queued: false; data: PosOrderDetail }
  | { queued: true; entityId: string; operationId: string };

export type PosOfflineTicketStatusResult =
  | { queued: false; data: ServiceTicketDetail }
  | { queued: true; entityId: string; operationId: string };

function createMutation<TPayload extends PosOfflinePayload>(
  entity: string,
  entityId: string,
  payload: TPayload,
): PosOfflineMutation<TPayload> {
  const operationId = createId();
  return {
    entity,
    entityId,
    operation: entity.endsWith(".create") ? "create" : "update",
    payload,
    id: operationId,
    idempotencyKey: createId(),
    metadata: { entityId },
  };
}
