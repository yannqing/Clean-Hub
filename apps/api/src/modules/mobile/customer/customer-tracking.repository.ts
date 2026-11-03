import {
  appointments,
  customers,
  deliveryTaskEvents,
  deliveryTasks,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, isNull } from "drizzle-orm";

export async function findCustomerAppointmentTracking(
  db: Database,
  input: {
    tenantId: string;
    customerAccountId: string;
    appointmentId: string;
  },
) {
  const [row] = await db
    .select({
      id: appointments.id,
      type: appointments.type,
      status: appointments.status,
      expectedAt: appointments.expectedAt,
      address: appointments.address,
      notes: appointments.notes,
      acceptedAt: appointments.acceptedAt,
      doneAt: appointments.doneAt,
      cancelledAt: appointments.cancelledAt,
      cancellationReason: appointments.cancellationReason,
      ticketId: appointments.ticketId,
      taskId: deliveryTasks.id,
      deliveryStatus: deliveryTasks.status,
      signedAt: deliveryTasks.signedAt,
    })
    .from(appointments)
    .innerJoin(
      customers,
      and(
        eq(customers.id, appointments.customerId),
        eq(customers.tenantId, input.tenantId),
      ),
    )
    .leftJoin(
      deliveryTasks,
      and(
        eq(deliveryTasks.id, appointments.deliveryTaskId),
        eq(deliveryTasks.tenantId, input.tenantId),
        isNull(deliveryTasks.deletedAt),
      ),
    )
    .where(
      and(
        eq(appointments.id, input.appointmentId),
        eq(appointments.tenantId, input.tenantId),
        eq(customers.customerAccountId, input.customerAccountId),
        isNull(customers.deletedAt),
        isNull(appointments.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const events = row.taskId
    ? await db
        .select({
          status: deliveryTaskEvents.toStatus,
          occurredAt: deliveryTaskEvents.createdAt,
        })
        .from(deliveryTaskEvents)
        .where(
          and(
            eq(deliveryTaskEvents.tenantId, input.tenantId),
            eq(deliveryTaskEvents.taskId, row.taskId),
          ),
        )
        .orderBy(asc(deliveryTaskEvents.createdAt))
    : [];
  // Never expose driver notes, GPS or other customers’ routes.
  return { ...row, events };
}
