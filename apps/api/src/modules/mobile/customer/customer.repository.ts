import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNull,
  sql,
} from "drizzle-orm";

import {
  appointments,
  branches,
  customerAccounts,
  customers,
  orderItems,
  orders,
  serviceTickets,
  ticketItems,
  type Database,
} from "@cleanhub/db";

import type {
  CustomerAppointment,
  CustomerAppointmentType,
  CustomerOrderDetail,
  CustomerOrderItem,
  CustomerOrderListItem,
  CustomerProfile,
  CustomerProfileAddress,
  CustomerTicketDetail,
  CustomerTicketItem,
  CustomerTicketListItem,
} from "./customer.types.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toAppointment(
  row: typeof appointments.$inferSelect,
): CustomerAppointment {
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
    acceptedAt: toIsoString(row.acceptedAt),
    cancelledAt: toIsoString(row.cancelledAt),
    doneAt: toIsoString(row.doneAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOrderListItem(
  row: typeof orders.$inferSelect,
): CustomerOrderListItem {
  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    expireAt: toIsoString(row.expireAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTicketListItem(
  row: typeof serviceTickets.$inferSelect,
): CustomerTicketListItem {
  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId,
    ticketNo: row.ticketNo,
    ticketType: row.ticketType,
    ticketStatus: row.ticketStatus,
    expectedPickupAt: toIsoString(row.expectedPickupAt),
    completedAt: toIsoString(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOrderItem(row: typeof orderItems.$inferSelect): CustomerOrderItem {
  return {
    id: row.id,
    itemName: row.itemName,
    quantity: row.quantity,
    unitAmount: row.unitAmount,
    lineAmount: row.lineAmount,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
  };
}

function toTicketItem(row: typeof ticketItems.$inferSelect): CustomerTicketItem {
  return {
    id: row.id,
    itemName: row.itemName,
    itemCategory: row.itemCategory,
    itemStatus: row.itemStatus,
    quantity: row.quantity,
    unitAmount: row.unitAmount,
    lineAmount: row.lineAmount,
    remark: row.remark,
  };
}

export class CustomerRepository {
  constructor(private readonly db: Database) {}

  async getProfile({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerProfile | null> {
    const accountRows = await this.db
      .select({
        id: customerAccounts.id,
        tenantId: customerAccounts.tenantId,
        accountName: customerAccounts.accountName,
        phone: customerAccounts.phone,
        email: customerAccounts.email,
        status: customerAccounts.status,
      })
      .from(customerAccounts)
      .where(
        and(
          eq(customerAccounts.id, customerAccountId),
          eq(customerAccounts.tenantId, tenantId),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .limit(1);

    const account = accountRows[0];

    if (!account) {
      return null;
    }

    const addressRows = await this.db
      .select({
        customerId: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        relationship: customers.relationship,
        address: customers.address,
        status: customers.status,
      })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(asc(customers.createdAt));

    return {
      account,
      addresses: addressRows satisfies CustomerProfileAddress[],
    };
  }

  async findOwnedCustomerById({
    tenantId,
    customerAccountId,
    customerId,
  }: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
  }): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findDefaultCustomer({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          eq(customers.status, "active"),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(asc(customers.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async findBranchInTenant({
    tenantId,
    branchId,
  }: {
    tenantId: string;
    branchId: string;
  }): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.id, branchId),
          eq(branches.tenantId, tenantId),
          eq(branches.status, "active"),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findDefaultBranch({
    tenantId,
  }: {
    tenantId: string;
  }): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.tenantId, tenantId),
          eq(branches.status, "active"),
          isNull(branches.deletedAt),
        ),
      )
      .orderBy(asc(branches.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async listOrders({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerOrderListItem[]> {
    const rows = await this.db
      .select({ ...getTableColumns(orders) })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(orders.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(desc(orders.createdAt));

    return rows.map(toOrderListItem);
  }

  async getOrderDetail({
    tenantId,
    customerAccountId,
    orderId,
  }: {
    tenantId: string;
    customerAccountId: string;
    orderId: string;
  }): Promise<CustomerOrderDetail | null> {
    const orderRows = await this.db
      .select({ ...getTableColumns(orders) })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(orders.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    const order = orderRows[0];

    if (!order) {
      return null;
    }

    const itemRows = await this.db
      .select({ ...getTableColumns(orderItems) })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.orderId, order.id),
          eq(orderItems.customerId, order.customerId),
          isNull(orderItems.deletedAt),
        ),
      )
      .orderBy(asc(orderItems.createdAt));

    return {
      ...toOrderListItem(order),
      orderType: order.orderType,
      notes: order.notes,
      items: itemRows.map(toOrderItem),
    };
  }

  async listTickets({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerTicketListItem[]> {
    const rows = await this.db
      .select({ ...getTableColumns(serviceTickets) })
      .from(serviceTickets)
      .innerJoin(customers, eq(customers.id, serviceTickets.customerId))
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(serviceTickets.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(desc(serviceTickets.createdAt));

    return rows.map(toTicketListItem);
  }

  async getTicketDetail({
    tenantId,
    customerAccountId,
    ticketId,
  }: {
    tenantId: string;
    customerAccountId: string;
    ticketId: string;
  }): Promise<CustomerTicketDetail | null> {
    const ticketRows = await this.db
      .select({ ...getTableColumns(serviceTickets) })
      .from(serviceTickets)
      .innerJoin(customers, eq(customers.id, serviceTickets.customerId))
      .where(
        and(
          eq(serviceTickets.id, ticketId),
          eq(serviceTickets.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(serviceTickets.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    const ticket = ticketRows[0];

    if (!ticket) {
      return null;
    }

    const itemRows = await this.db
      .select({ ...getTableColumns(ticketItems) })
      .from(ticketItems)
      .where(
        and(
          eq(ticketItems.tenantId, tenantId),
          eq(ticketItems.ticketId, ticket.id),
          isNull(ticketItems.deletedAt),
        ),
      )
      .orderBy(asc(ticketItems.sortOrder), asc(ticketItems.createdAt));

    return {
      ...toTicketListItem(ticket),
      priority: ticket.priority,
      remark: ticket.remark,
      items: itemRows.map(toTicketItem),
    };
  }

  async createAppointment(input: {
    tenantId: string;
    branchId: string;
    customerId: string;
    type: CustomerAppointmentType;
    expectedAt: Date;
    address: string;
    notes?: string;
  }): Promise<CustomerAppointment> {
    const rows = await this.db
      .insert(appointments)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        type: input.type,
        status: "pending",
        expectedAt: input.expectedAt,
        address: input.address,
        notes: input.notes,
      })
      .returning({ ...getTableColumns(appointments) });

    const appointment = rows[0];

    if (!appointment) {
      throw new Error("Appointment insert failed.");
    }

    return toAppointment(appointment);
  }

  async listAppointments({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerAppointment[]> {
    const rows = await this.db
      .select({ ...getTableColumns(appointments) })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(appointments.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(desc(appointments.expectedAt), desc(appointments.createdAt));

    return rows.map(toAppointment);
  }

  async findOwnedAppointmentById({
    tenantId,
    customerAccountId,
    appointmentId,
  }: {
    tenantId: string;
    customerAccountId: string;
    appointmentId: string;
  }): Promise<CustomerAppointment | null> {
    const rows = await this.db
      .select({ ...getTableColumns(appointments) })
      .from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.tenantId, tenantId),
          eq(customers.tenantId, tenantId),
          eq(customers.customerAccountId, customerAccountId),
          isNull(appointments.deletedAt),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toAppointment(rows[0]) : null;
  }

  async cancelPendingAppointment({
    tenantId,
    appointmentId,
  }: {
    tenantId: string;
    appointmentId: string;
  }): Promise<CustomerAppointment | null> {
    const now = new Date();
    const rows = await this.db
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        version: sql`${appointments.version} + 1`,
      })
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.tenantId, tenantId),
          eq(appointments.status, "pending"),
          isNull(appointments.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(appointments) });

    return rows[0] ? toAppointment(rows[0]) : null;
  }
}
