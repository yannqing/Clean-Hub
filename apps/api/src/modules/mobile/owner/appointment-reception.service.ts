import {
  appointments,
  deliveryTasks,
  getDb,
  type Database,
} from "@cleanhub/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import {
  requirePosBranchAccess,
  requirePosRole,
  requirePosTenantId,
} from "../../pos/access-control.helper.js";
import { createPosServiceTicket } from "../../pos/service-tickets/service-tickets.service.js";
import { PosOrderError } from "../../pos/orders/orders.errors.js";

/** Receive physical pickup items at the store before adding priced services in POS. */
export async function receiveCustomerAppointment(
  auth: AuthContext,
  appointmentId: string,
  ticketType: "laundry" | "car_wash",
  db: Database = getDb(),
) {
  const tenantId = requirePosTenantId(auth);
  requirePosRole(auth, ["owner", "manager"]);
  return db.transaction(async (tx) => {
    const [appointment] = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.id, appointmentId),
          isNull(appointments.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!appointment)
      throw new PosOrderError(
        "ORDER_NOT_FOUND",
        "Appointment was not found.",
        404,
      );
    requirePosBranchAccess(auth, appointment.branchId);
    if (appointment.type !== "pickup" || appointment.status !== "done")
      throw new AuthError(
        "FORBIDDEN",
        "Complete the pickup before receiving items at the store.",
      );
    if (appointment.ticketId)
      return { ticketId: appointment.ticketId, idempotent: true };
    const ticket = await createPosServiceTicket(
      auth,
      {
        branchId: appointment.branchId,
        customerId: appointment.customerId,
        ticketType,
        sourceChannel: "app",
        remark: appointment.notes ?? undefined,
      },
      {},
      tx,
    );
    await tx
      .update(appointments)
      .set({
        ticketId: ticket.id,
        updatedAt: new Date(),
        updatedBy: auth.userId,
        version: sql`${appointments.version} + 1`,
      })
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.id, appointmentId),
        ),
      );
    if (appointment.deliveryTaskId)
      await tx
        .update(deliveryTasks)
        .set({
          ticketId: ticket.id,
          updatedAt: new Date(),
          updatedBy: auth.userId,
          version: sql`${deliveryTasks.version} + 1`,
        })
        .where(
          and(
            eq(deliveryTasks.tenantId, tenantId),
            eq(deliveryTasks.id, appointment.deliveryTaskId),
          ),
        );
    return { ticketId: ticket.id, idempotent: false };
  });
}
