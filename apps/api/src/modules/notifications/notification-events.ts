import type {
  NotificationEvent,
  NotificationPublishResult,
} from "./notifications.types.js";

export type NotificationEventHandler = (
  event: NotificationEvent,
) => Promise<NotificationPublishResult>;

export class InMemoryNotificationEventBus {
  private readonly handlers = new Set<NotificationEventHandler>();

  subscribe(handler: NotificationEventHandler): () => void {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  async publish(event: NotificationEvent): Promise<NotificationPublishResult> {
    const total: NotificationPublishResult = {
      matched: 0,
      enqueued: 0,
      skipped: 0,
      idempotent: 0,
    };

    for (const handler of this.handlers) {
      const result = await handler(event);

      total.matched += result.matched;
      total.enqueued += result.enqueued;
      total.skipped += result.skipped;
      total.idempotent += result.idempotent;
    }

    return total;
  }
}

export function orderCreatedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  orderId: string;
  orderNo?: string | null;
  totalAmount?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "order.created",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "order",
    relatedId: input.orderId,
    locale: input.locale,
    idempotencyKey: `order.created:${input.orderId}`,
    payload: {
      orderId: input.orderId,
      orderNo: input.orderNo ?? input.orderId,
      totalAmount: input.totalAmount ?? null,
    },
  };
}

export function orderCompletedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  orderId: string;
  orderNo?: string | null;
  totalAmount?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "order.completed",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "order",
    relatedId: input.orderId,
    locale: input.locale,
    idempotencyKey: `order.completed:${input.orderId}`,
    payload: {
      orderId: input.orderId,
      orderNo: input.orderNo ?? input.orderId,
      totalAmount: input.totalAmount ?? null,
    },
  };
}

export function deliveryStatusChangedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  taskId: string;
  type: "pickup" | "dropoff";
  fromStatus?: string | null;
  toStatus: string;
  orderId?: string | null;
  ticketId?: string | null;
  customerName?: string | null;
  expectedAt?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "delivery.status_changed",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "delivery_task",
    relatedId: input.taskId,
    locale: input.locale,
    idempotencyKey: `delivery.status_changed:${input.taskId}:${input.toStatus}`,
    payload: {
      taskId: input.taskId,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      orderId: input.orderId ?? null,
      ticketId: input.ticketId ?? null,
      customerName: input.customerName ?? null,
      expectedAt: input.expectedAt ?? null,
    },
  };
}
