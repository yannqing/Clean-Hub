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

/**
 * The garments are washed and waiting on the shelf.
 *
 * The single most useful message a laundry sends: without it a walk-in
 * customer has no way to know their order is ready, which is what leaves
 * finished work sitting on the shelf. `ticket.overdue` is a later, separate
 * reminder for items nobody came back for.
 */
export function ticketReadyForPickupEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  ticketId: string;
  ticketNo?: string | null;
  customerName?: string | null;
  expectedPickupAt?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "ticket.ready_for_pickup",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "ticket",
    relatedId: input.ticketId,
    locale: input.locale,
    // A ticket can leave and re-enter ready_to_pick when an item goes back for
    // rework, and the customer should not be told twice for the same ticket.
    idempotencyKey: `ticket.ready_for_pickup:${input.ticketId}`,
    payload: {
      ticketId: input.ticketId,
      ticketNo: input.ticketNo ?? input.ticketId,
      customerName: input.customerName ?? null,
      expectedPickupAt: input.expectedPickupAt ?? null,
    },
  };
}

export function appointmentAcceptedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  appointmentId: string;
  customerName?: string | null;
  appointmentType: "pickup" | "dropoff";
  expectedAt: string;
  address: string;
  taskId?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "appointment.accepted",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "appointment",
    relatedId: input.appointmentId,
    locale: input.locale,
    idempotencyKey: `appointment.accepted:${input.appointmentId}`,
    payload: {
      appointmentId: input.appointmentId,
      customerName: input.customerName ?? null,
      appointmentType: input.appointmentType,
      expectedAt: input.expectedAt,
      address: input.address,
      taskId: input.taskId ?? null,
    },
  };
}

export function appointmentRejectedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  appointmentId: string;
  customerName?: string | null;
  appointmentType: "pickup" | "dropoff";
  expectedAt: string;
  address: string;
  reason?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "appointment.rejected",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "appointment",
    relatedId: input.appointmentId,
    locale: input.locale,
    idempotencyKey: `appointment.rejected:${input.appointmentId}`,
    payload: {
      appointmentId: input.appointmentId,
      customerName: input.customerName ?? null,
      appointmentType: input.appointmentType,
      expectedAt: input.expectedAt,
      address: input.address,
      reason: input.reason ?? null,
    },
  };
}

export function refundApprovedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  refundRequestId: string;
  orderId: string;
  amount: string;
  reason: string;
  status: string;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "refund.approved",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "refund_request",
    relatedId: input.refundRequestId,
    locale: input.locale,
    idempotencyKey: `refund.approved:${input.refundRequestId}`,
    payload: {
      refundRequestId: input.refundRequestId,
      orderId: input.orderId,
      amount: input.amount,
      reason: input.reason,
      status: input.status,
    },
  };
}

export function refundRejectedEvent(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
  refundRequestId: string;
  orderId: string;
  amount: string;
  reason: string;
  rejectionReason?: string | null;
  locale?: string | null;
}): NotificationEvent {
  return {
    name: "refund.rejected",
    tenantId: input.tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    relatedType: "refund_request",
    relatedId: input.refundRequestId,
    locale: input.locale,
    idempotencyKey: `refund.rejected:${input.refundRequestId}`,
    payload: {
      refundRequestId: input.refundRequestId,
      orderId: input.orderId,
      amount: input.amount,
      reason: input.reason,
      rejectionReason: input.rejectionReason ?? null,
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
