import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  lt,
  sql,
} from "drizzle-orm";
import { createId } from "@cleanhub/id";

import {
  appointments,
  customers,
  deliveryTasks,
  orders,
  paymentTransactions,
  serviceTickets,
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";

import type {
  OwnerAppointment,
  OwnerAppointmentStatus,
  OwnerTodaySummary,
} from "./owner.types.js";

type TenantBase = Pick<
  OwnerTodaySummary,
  "tenantId" | "tenantName" | "tenantStatus" | "featureFlags"
>;

function emptyAppointmentSummary(): OwnerTodaySummary["appointmentSummary"] {
  return {
    pending: 0,
    accepted: 0,
    cancelled: 0,
    done: 0,
  };
}

function emptyDeliverySummary(): OwnerTodaySummary["deliverySummary"] {
  return {
    pendingDispatch: 0,
    inProgress: 0,
    signed: 0,
    exception: 0,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toAppointment(row: typeof appointments.$inferSelect): OwnerAppointment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    customerId: row.customerId,
    type: row.type,
    status: row.status,
    expectedAt: row.expectedAt.toISOString(),
    address: row.address,
    notes: row.notes,
    deliveryTaskId: row.deliveryTaskId,
    acceptedAt: toIsoString(row.acceptedAt),
    acceptedBy: row.acceptedBy,
    cancelledAt: toIsoString(row.cancelledAt),
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    doneAt: toIsoString(row.doneAt),
    doneBy: row.doneBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class OwnerRepository {
  constructor(private readonly db: Database) {}

  async findTenantBase(tenantId: string): Promise<TenantBase | null> {
    const rows = await this.db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantStatus: tenants.status,
        laundryEnabled: tenantFeatureFlags.laundryEnabled,
        carWashEnabled: tenantFeatureFlags.carWashEnabled,
        retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
        deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
        notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
      })
      .from(tenants)
      .innerJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
      .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      tenantStatus: row.tenantStatus,
      featureFlags: {
        laundryEnabled: row.laundryEnabled,
        carWashEnabled: row.carWashEnabled,
        retailProductsEnabled: row.retailProductsEnabled,
        deliveryEnabled: row.deliveryEnabled,
        notificationsEnabled: row.notificationsEnabled,
      },
    };
  }

  async countTodayOrders(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, input.tenantId),
          gte(orders.createdAt, input.start),
          lt(orders.createdAt, input.end),
          isNull(orders.deletedAt),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  async sumTodayRevenue(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<number> {
    const rows = await this.db
      .select({
        value: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text`,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          eq(paymentTransactions.paymentStatus, "paid"),
          gte(paymentTransactions.paidAt, input.start),
          lt(paymentTransactions.paidAt, input.end),
          isNull(paymentTransactions.deletedAt),
        ),
      );

    return toNumber(rows[0]?.value);
  }

  async countPendingPickup(tenantId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          eq(serviceTickets.ticketStatus, "ready_to_pick"),
          isNull(serviceTickets.deletedAt),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  async countInProgressOrders(tenantId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          eq(serviceTickets.ticketStatus, "in_progress"),
          isNull(serviceTickets.deletedAt),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  async getAppointmentSummary(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<OwnerTodaySummary["appointmentSummary"]> {
    const rows = await this.db
      .select({
        status: appointments.status,
        value: count(),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, input.tenantId),
          gte(appointments.expectedAt, input.start),
          lt(appointments.expectedAt, input.end),
          isNull(appointments.deletedAt),
        ),
      )
      .groupBy(appointments.status);

    const summary = emptyAppointmentSummary();

    for (const row of rows) {
      summary[row.status] = row.value;
    }

    return summary;
  }

  async getDeliverySummary(input: {
    tenantId: string;
    start: Date;
    end: Date;
  }): Promise<OwnerTodaySummary["deliverySummary"]> {
    const rows = await this.db
      .select({
        status: deliveryTasks.status,
        value: count(),
      })
      .from(deliveryTasks)
      .where(
        and(
          eq(deliveryTasks.tenantId, input.tenantId),
          gte(deliveryTasks.expectedAt, input.start),
          lt(deliveryTasks.expectedAt, input.end),
          isNull(deliveryTasks.deletedAt),
        ),
      )
      .groupBy(deliveryTasks.status);

    const summary = emptyDeliverySummary();

    for (const row of rows) {
      if (row.status === "pending_dispatch") {
        summary.pendingDispatch += row.value;
      } else if (row.status === "signed") {
        summary.signed += row.value;
      } else if (row.status === "exception") {
        summary.exception += row.value;
      } else if (
        row.status === "en_route" ||
        row.status === "arrived" ||
        row.status === "picked_up" ||
        row.status === "delivering"
      ) {
        summary.inProgress += row.value;
      }
    }

    return summary;
  }

  async listAppointments(input: {
    tenantId: string;
    branchId?: string;
    status?: OwnerAppointmentStatus;
  }): Promise<OwnerAppointment[]> {
    const rows = await this.db
      .select({ ...getTableColumns(appointments) })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, input.tenantId),
          input.branchId ? eq(appointments.branchId, input.branchId) : undefined,
          input.status ? eq(appointments.status, input.status) : undefined,
          isNull(appointments.deletedAt),
        ),
      )
      .orderBy(asc(appointments.expectedAt), desc(appointments.createdAt));

    return rows.map(toAppointment);
  }

  async findAppointmentById(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<OwnerAppointment | null> {
    const rows = await this.db
      .select({ ...getTableColumns(appointments) })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.tenantId, input.tenantId),
          isNull(appointments.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async acceptAppointmentAndCreateTask(input: {
    tenantId: string;
    appointmentId: string;
    operatorUserId: string;
    assigneeUserId?: string;
    notes?: string;
  }): Promise<{ appointment: OwnerAppointment; taskId: string } | null> {
    return this.db.transaction(async (tx) => {
      const [appointment] = await tx
        .select({ ...getTableColumns(appointments) })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            isNull(appointments.deletedAt),
          ),
        )
        .limit(1);

      if (!appointment) {
        return null;
      }

      if (appointment.deliveryTaskId && appointment.status === "accepted") {
        return { appointment: toAppointment(appointment), taskId: appointment.deliveryTaskId };
      }

      if (appointment.status !== "pending") {
        return null;
      }

      const [customer] = await tx
        .select({
          fullName: customers.fullName,
          phone: customers.phone,
        })
        .from(customers)
        .where(
          and(
            eq(customers.id, appointment.customerId),
            eq(customers.tenantId, input.tenantId),
            isNull(customers.deletedAt),
          ),
        )
        .limit(1);

      if (!customer) {
        return null;
      }

      const now = new Date();
      const taskId = createId();

      await tx.insert(deliveryTasks).values({
        id: taskId,
        tenantId: appointment.tenantId,
        branchId: appointment.branchId,
        assigneeUserId: input.assigneeUserId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        type: appointment.type,
        status: "pending_dispatch",
        expectedAt: appointment.expectedAt,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        address: appointment.address,
        notes: input.notes ?? appointment.notes,
        createdBy: input.operatorUserId,
        updatedBy: input.operatorUserId,
        dispatchedAt: input.assigneeUserId ? now : undefined,
        dispatchedBy: input.assigneeUserId ? input.operatorUserId : undefined,
      });

      const [updated] = await tx
        .update(appointments)
        .set({
          status: "accepted",
          deliveryTaskId: taskId,
          acceptedAt: now,
          acceptedBy: input.operatorUserId,
          updatedAt: now,
          updatedBy: input.operatorUserId,
          version: sql`${appointments.version} + 1`,
        })
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.status, "pending"),
            isNull(appointments.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(appointments) });

      return updated ? { appointment: toAppointment(updated), taskId } : null;
    });
  }

  async rejectPendingAppointment(input: {
    tenantId: string;
    appointmentId: string;
    operatorUserId: string;
    reason: string;
  }): Promise<OwnerAppointment | null> {
    const now = new Date();
    const rows = await this.db
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: input.operatorUserId,
        cancellationReason: input.reason,
        updatedAt: now,
        updatedBy: input.operatorUserId,
        version: sql`${appointments.version} + 1`,
      })
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.tenantId, input.tenantId),
          eq(appointments.status, "pending"),
          isNull(appointments.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(appointments) });

    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async markAppointmentDoneFromDelivery(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void> {
    const now = new Date();

    await this.db
      .update(appointments)
      .set({
        status: "done",
        doneAt: now,
        doneBy: input.operatorUserId,
        updatedAt: now,
        updatedBy: input.operatorUserId,
        version: sql`${appointments.version} + 1`,
      })
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.tenantId, input.tenantId),
          eq(appointments.deliveryTaskId, input.taskId),
          isNull(appointments.deletedAt),
        ),
      );
  }

  async reopenAppointmentFromCancelledDelivery(input: {
    tenantId: string;
    appointmentId: string;
    taskId: string;
    operatorUserId: string;
  }): Promise<void> {
    const now = new Date();

    await this.db
      .update(appointments)
      .set({
        status: "accepted",
        deliveryTaskId: null,
        doneAt: null,
        doneBy: null,
        updatedAt: now,
        updatedBy: input.operatorUserId,
        version: sql`${appointments.version} + 1`,
      })
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.tenantId, input.tenantId),
          eq(appointments.deliveryTaskId, input.taskId),
          isNull(appointments.deletedAt),
        ),
      );
  }
}
