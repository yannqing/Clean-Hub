import {
  appointments,
  orderTicketReferences,
  orders,
  serviceTickets,
  type Database,
} from "@cleanhub/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { PosOrderError } from "../../pos/orders/orders.errors.js";
import { changePosOrderStatus } from "../../pos/orders/orders.service.js";
import { areLinkedOrdersSettled } from "../../pos/service-tickets/service-tickets.repository.js";
import { changePosServiceTicketStatus } from "../../pos/service-tickets/service-tickets.service.js";

export type DeliveryBusinessLink = {
  tenantId: string;
  branchId: string;
  customerId: string;
  type: "pickup" | "dropoff";
  ticketId?: string | null;
  orderId?: string | null;
};

export async function assertDeliveryBusinessLink(
  db: Database,
  input: DeliveryBusinessLink,
  completing = false,
) {
  const linked = input.ticketId
    ? await db
        .select()
        .from(serviceTickets)
        .where(
          and(
            eq(serviceTickets.tenantId, input.tenantId),
            eq(serviceTickets.id, input.ticketId),
            eq(serviceTickets.branchId, input.branchId),
            eq(serviceTickets.customerId, input.customerId),
            isNull(serviceTickets.deletedAt),
          ),
        )
        .limit(1)
    : [];
  if (input.ticketId && !linked[0])
    throw new AuthError(
      "FORBIDDEN",
      "The delivery work order does not belong to this customer and store.",
    );
  const orderRows = input.orderId
    ? await db
        .select({
          id: orders.id,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          version: orders.version,
          customerId: orders.customerId,
          branchId: orders.branchId,
        })
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, input.tenantId),
            eq(orders.id, input.orderId),
            isNull(orders.deletedAt),
          ),
        )
    : [];
  // Load every linked order, including split bills; never infer ownership from an FK alone.
  const allOrders = input.ticketId
    ? await db
        .select({
          id: orders.id,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          version: orders.version,
          customerId: orders.customerId,
          branchId: orders.branchId,
        })
        .from(orderTicketReferences)
        .innerJoin(
          orders,
          and(
            eq(orders.id, orderTicketReferences.orderId),
            eq(orders.tenantId, input.tenantId),
          ),
        )
        .where(
          and(
            eq(orderTicketReferences.tenantId, input.tenantId),
            eq(orderTicketReferences.ticketId, input.ticketId),
            isNull(orders.deletedAt),
          ),
        )
    : orderRows;
  if (
    allOrders.some(
      (order) =>
        order.branchId !== input.branchId ||
        order.customerId !== input.customerId,
    )
  )
    throw new AuthError(
      "FORBIDDEN",
      "The delivery order does not belong to this customer and store.",
    );
  if (input.orderId && !allOrders.some((order) => order.id === input.orderId))
    throw new AuthError(
      "FORBIDDEN",
      "The delivery order does not match the work order.",
    );
  if (input.type === "dropoff") {
    if (!input.ticketId && !input.orderId)
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Select the work order or order to be delivered.",
        422,
      );
    if (
      linked[0] &&
      !(
        completing ? ["ready_to_pick", "picked_up"] : ["ready_to_pick"]
      ).includes(linked[0].ticketStatus)
    )
      throw new PosOrderError(
        "ORDER_FULFILMENT_PENDING",
        "The work order is not ready for delivery.",
        422,
      );
    if (
      linked[0] &&
      !(await areLinkedOrdersSettled(db, {
        tenantId: input.tenantId,
        ticketId: linked[0].id,
      }))
    )
      throw new PosOrderError(
        "ORDER_NOT_PAID",
        "Settle all linked orders before requesting delivery.",
        422,
      );
    if (
      !allOrders.length ||
      allOrders.some(
        (order) =>
          order.paymentStatus !== "paid" ||
          !["paid", "delivered"].includes(order.status),
      )
    )
      throw new PosOrderError(
        "ORDER_NOT_PAID",
        "Settle all linked orders before requesting delivery.",
        422,
      );
  }
  return { ticket: linked[0], orders: allOrders };
}

/** Calls the same status/payment rules as POS, inside the signature transaction. */
export async function completeDeliveryBusinessRecords(
  db: Database,
  input: DeliveryBusinessLink & { driverUserId: string },
) {
  if (input.type !== "dropoff") return [] as string[];
  const linked = await assertDeliveryBusinessLink(db, input, true);
  // Action-only internal adapter after assigned-driver authorization. It is
  // never issued as a login session and remains fixed to the task's branch.
  const actor: AuthContext = {
    tenantId: input.tenantId,
    userId: input.driverUserId,
    displayName: "",
    role: "cashier",
    roles: ["driver"],
    permissions: [],
    branchIds: [input.branchId],
    accessTokenExpiresAt: "",
  };
  if (linked.ticket && linked.ticket.ticketStatus !== "picked_up") {
    await changePosServiceTicketStatus(
      actor,
      linked.ticket.id,
      {
        to: "picked_up",
        version: linked.ticket.version,
        note: "Customer delivery signature recorded.",
      },
      {},
      db,
    );
  }
  const completed: string[] = [];
  for (const order of linked.orders) {
    if (order.status === "delivered") continue;
    // An order may include several work orders delivered on different routes.
    // Leave it paid until every linked ticket has been picked up.
    const pendingTickets = await db
      .select({ status: serviceTickets.ticketStatus })
      .from(orderTicketReferences)
      .innerJoin(
        serviceTickets,
        and(
          eq(serviceTickets.id, orderTicketReferences.ticketId),
          eq(serviceTickets.tenantId, input.tenantId),
        ),
      )
      .where(
        and(
          eq(orderTicketReferences.tenantId, input.tenantId),
          eq(orderTicketReferences.orderId, order.id),
          isNull(serviceTickets.deletedAt),
        ),
      );
    if (pendingTickets.some((ticket) => ticket.status !== "picked_up"))
      continue;
    await changePosOrderStatus(
      actor,
      order.id,
      { to: "delivered", version: order.version },
      {},
      db,
    );
    completed.push(order.id);
  }
  return completed;
}

/** Only reopen the appointment still linked to this cancelled task. A replay
 * cannot detach a replacement task, nor reopen a completed appointment. */
export async function reopenCancelledDeliveryAppointment(db: Database, input: {
  tenantId: string; appointmentId: string; taskId: string; operatorUserId: string;
}): Promise<void> {
  await db.update(appointments).set({
    status: "pending",
    deliveryTaskId: null,
    acceptedAt: null,
    acceptedBy: null,
    doneAt: null,
    doneBy: null,
    updatedAt: new Date(),
    updatedBy: input.operatorUserId,
    version: sql`${appointments.version} + 1`,
  }).where(and(
    eq(appointments.tenantId, input.tenantId),
    eq(appointments.id, input.appointmentId),
    eq(appointments.deliveryTaskId, input.taskId),
    eq(appointments.status, "accepted"),
    isNull(appointments.deletedAt),
  ));
}
