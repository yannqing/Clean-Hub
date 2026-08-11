import { createId } from "@cleanhub/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  appointments,
  branches,
  customerAccounts,
  customerAddresses,
  customerAuthRefreshTokens,
  customerCredentials,
  customers,
  orderItems,
  orders,
  serviceTickets,
  ticketItems,
  type Database,
} from "@cleanhub/db";

import type {
  CustomerAddress,
  CustomerAddressWriteInput,
  CustomerAppointment,
  CustomerAppointmentType,
  CustomerBranchOption,
  CustomerContact,
  CustomerContactWriteInput,
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

function toCustomerAddress(
  row: typeof customerAddresses.$inferSelect,
): CustomerAddress {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerAccountId: row.customerAccountId,
    customerId: row.customerId,
    label: row.label,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    isDefault: row.isDefault,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCustomerContact(row: typeof customers.$inferSelect): CustomerContact {
  return {
    customerId: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
    address: row.address,
    status: row.status,
  };
}

function toOrderListItem(
  row: typeof orders.$inferSelect,
): CustomerOrderListItem {
  if (!row.customerId) {
    throw new Error("Customer order projection requires a customer profile.");
  }
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

  async updateProfile(input: {
    tenantId: string;
    customerAccountId: string;
    accountName?: string;
    phone?: string | null;
    email?: string | null;
  }): Promise<CustomerProfile | null> {
    const now = new Date();
    const values: {
      updatedAt: Date;
      version: SQL;
      accountName?: string;
      phone?: string | null;
      email?: string | null;
    } = {
      updatedAt: now,
      version: sql`${customerAccounts.version} + 1`,
    };

    if (input.accountName !== undefined) {
      values.accountName = input.accountName;
    }

    if (input.phone !== undefined) {
      values.phone = input.phone;
    }

    if (input.email !== undefined) {
      values.email = input.email;
    }

    const rows = await this.db
      .update(customerAccounts)
      .set(values)
      .where(
        and(
          eq(customerAccounts.id, input.customerAccountId),
          eq(customerAccounts.tenantId, input.tenantId),
          isNull(customerAccounts.deletedAt),
        ),
      )
      .returning({ id: customerAccounts.id });

    if (!rows[0]) {
      return null;
    }

    return this.getProfile({
      tenantId: input.tenantId,
      customerAccountId: input.customerAccountId,
    });
  }

  async createContact(input: {
    tenantId: string;
    customerAccountId: string;
    data: CustomerContactWriteInput;
  }): Promise<CustomerContact> {
    const rows = await this.db
      .insert(customers)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        customerAccountId: input.customerAccountId,
        fullName: input.data.fullName,
        phone: input.data.phone,
        email: input.data.email,
        relationship: input.data.relationship,
        address: input.data.address,
        status: "active",
      })
      .returning({ ...getTableColumns(customers) });

    const contact = rows[0];

    if (!contact) {
      throw new Error("Customer contact insert failed.");
    }

    return toCustomerContact(contact);
  }

  async updateContact(input: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
    data: CustomerContactWriteInput;
  }): Promise<CustomerContact | null> {
    const now = new Date();
    const rows = await this.db
      .update(customers)
      .set({
        fullName: input.data.fullName,
        phone: input.data.phone,
        email: input.data.email,
        relationship: input.data.relationship,
        address: input.data.address,
        updatedAt: now,
        version: sql`${customers.version} + 1`,
      })
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.tenantId, input.tenantId),
          eq(customers.customerAccountId, input.customerAccountId),
          isNull(customers.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(customers) });

    return rows[0] ? toCustomerContact(rows[0]) : null;
  }

  async softDeleteContact(input: {
    tenantId: string;
    customerAccountId: string;
    customerId: string;
  }): Promise<CustomerContact | null> {
    const now = new Date();
    const rows = await this.db
      .update(customers)
      .set({
        deletedAt: now,
        updatedAt: now,
        version: sql`${customers.version} + 1`,
      })
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.tenantId, input.tenantId),
          eq(customers.customerAccountId, input.customerAccountId),
          isNull(customers.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(customers) });

    return rows[0] ? toCustomerContact(rows[0]) : null;
  }

  async listAddresses(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<CustomerAddress[]> {
    const rows = await this.db
      .select({ ...getTableColumns(customerAddresses) })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.tenantId, input.tenantId),
          eq(customerAddresses.customerAccountId, input.customerAccountId),
          isNull(customerAddresses.deletedAt),
        ),
      )
      .orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt));

    return rows.map(toCustomerAddress);
  }

  async listBranches(input: { tenantId: string }): Promise<CustomerBranchOption[]> {
    const rows = await this.db
      .select({
        id: branches.id,
        name: branches.name,
        address: branches.address,
        status: branches.status,
      })
      .from(branches)
      .where(
        and(
          eq(branches.tenantId, input.tenantId),
          eq(branches.status, "active"),
          isNull(branches.deletedAt),
        ),
      )
      .orderBy(asc(branches.name), asc(branches.createdAt));

    return rows;
  }

  async findOwnedAddressById(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null> {
    const rows = await this.db
      .select({ ...getTableColumns(customerAddresses) })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, input.addressId),
          eq(customerAddresses.tenantId, input.tenantId),
          eq(customerAddresses.customerAccountId, input.customerAccountId),
          isNull(customerAddresses.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ? toCustomerAddress(rows[0]) : null;
  }

  async createAddress(input: {
    tenantId: string;
    customerAccountId: string;
    data: CustomerAddressWriteInput;
  }): Promise<CustomerAddress> {
    return this.db.transaction(async (tx) => {
      const now = new Date();

      if (input.data.isDefault) {
        await tx
          .update(customerAddresses)
          .set({
            isDefault: false,
            updatedAt: now,
            version: sql`${customerAddresses.version} + 1`,
          })
          .where(
            and(
              eq(customerAddresses.tenantId, input.tenantId),
              eq(customerAddresses.customerAccountId, input.customerAccountId),
              eq(customerAddresses.isDefault, true),
              isNull(customerAddresses.deletedAt),
            ),
          );
      }

      const rows = await tx
        .insert(customerAddresses)
        .values({
          id: createId(),
          tenantId: input.tenantId,
          customerAccountId: input.customerAccountId,
          customerId: input.data.customerId ?? null,
          label: input.data.label,
          contactName: input.data.contactName,
          contactPhone: input.data.contactPhone,
          addressLine1: input.data.addressLine1,
          addressLine2: input.data.addressLine2,
          city: input.data.city,
          province: input.data.province,
          postalCode: input.data.postalCode,
          country: input.data.country ?? "TH",
          latitude: input.data.latitude,
          longitude: input.data.longitude,
          isDefault: input.data.isDefault ?? false,
          notes: input.data.notes,
        })
        .returning({ ...getTableColumns(customerAddresses) });

      return toCustomerAddress(rows[0]);
    });
  }

  async updateAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
    data: CustomerAddressWriteInput;
  }): Promise<CustomerAddress | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();

      if (input.data.isDefault) {
        await tx
          .update(customerAddresses)
          .set({
            isDefault: false,
            updatedAt: now,
            version: sql`${customerAddresses.version} + 1`,
          })
          .where(
            and(
              eq(customerAddresses.tenantId, input.tenantId),
              eq(customerAddresses.customerAccountId, input.customerAccountId),
              eq(customerAddresses.isDefault, true),
              isNull(customerAddresses.deletedAt),
            ),
          );
      }

      const rows = await tx
        .update(customerAddresses)
        .set({
          customerId: input.data.customerId ?? null,
          label: input.data.label,
          contactName: input.data.contactName,
          contactPhone: input.data.contactPhone,
          addressLine1: input.data.addressLine1,
          addressLine2: input.data.addressLine2,
          city: input.data.city,
          province: input.data.province,
          postalCode: input.data.postalCode,
          country: input.data.country ?? "TH",
          latitude: input.data.latitude,
          longitude: input.data.longitude,
          isDefault: input.data.isDefault ?? false,
          notes: input.data.notes,
          updatedAt: now,
          version: sql`${customerAddresses.version} + 1`,
        })
        .where(
          and(
            eq(customerAddresses.id, input.addressId),
            eq(customerAddresses.tenantId, input.tenantId),
            eq(customerAddresses.customerAccountId, input.customerAccountId),
            isNull(customerAddresses.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(customerAddresses) });

      return rows[0] ? toCustomerAddress(rows[0]) : null;
    });
  }

  async softDeleteAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null> {
    const now = new Date();
    const rows = await this.db
      .update(customerAddresses)
      .set({
        isDefault: false,
        deletedAt: now,
        updatedAt: now,
        version: sql`${customerAddresses.version} + 1`,
      })
      .where(
        and(
          eq(customerAddresses.id, input.addressId),
          eq(customerAddresses.tenantId, input.tenantId),
          eq(customerAddresses.customerAccountId, input.customerAccountId),
          isNull(customerAddresses.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(customerAddresses) });

    return rows[0] ? toCustomerAddress(rows[0]) : null;
  }

  async setDefaultAddress(input: {
    tenantId: string;
    customerAccountId: string;
    addressId: string;
  }): Promise<CustomerAddress | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const existingRows = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, input.addressId),
            eq(customerAddresses.tenantId, input.tenantId),
            eq(customerAddresses.customerAccountId, input.customerAccountId),
            isNull(customerAddresses.deletedAt),
          ),
        )
        .limit(1);

      if (!existingRows[0]) {
        return null;
      }

      await tx
        .update(customerAddresses)
        .set({
          isDefault: false,
          updatedAt: now,
          version: sql`${customerAddresses.version} + 1`,
        })
        .where(
          and(
            eq(customerAddresses.tenantId, input.tenantId),
            eq(customerAddresses.customerAccountId, input.customerAccountId),
            eq(customerAddresses.isDefault, true),
            isNull(customerAddresses.deletedAt),
          ),
        );

      const rows = await tx
        .update(customerAddresses)
        .set({
          isDefault: true,
          updatedAt: now,
          version: sql`${customerAddresses.version} + 1`,
        })
        .where(
          and(
            eq(customerAddresses.id, input.addressId),
            eq(customerAddresses.tenantId, input.tenantId),
            eq(customerAddresses.customerAccountId, input.customerAccountId),
            isNull(customerAddresses.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(customerAddresses) });

      return rows[0] ? toCustomerAddress(rows[0]) : null;
    });
  }

  async findCustomerCredential(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<{ id: string; passwordHash: string } | null> {
    const rows = await this.db
      .select({
        id: customerCredentials.id,
        passwordHash: customerCredentials.passwordHash,
      })
      .from(customerCredentials)
      .where(
        and(
          eq(customerCredentials.tenantId, input.tenantId),
          eq(customerCredentials.customerAccountId, input.customerAccountId),
          isNull(customerCredentials.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async updateCustomerPassword(input: {
    tenantId: string;
    customerAccountId: string;
    credentialId: string;
    passwordHash: string;
  }): Promise<void> {
    const now = new Date();
    await this.db
      .update(customerCredentials)
      .set({
        passwordHash: input.passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
        version: sql`${customerCredentials.version} + 1`,
      })
      .where(
        and(
          eq(customerCredentials.id, input.credentialId),
          eq(customerCredentials.tenantId, input.tenantId),
          eq(customerCredentials.customerAccountId, input.customerAccountId),
          isNull(customerCredentials.deletedAt),
        ),
      );
  }

  async revokeCustomerRefreshTokens(input: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<void> {
    await this.db
      .update(customerAuthRefreshTokens)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAuthRefreshTokens.tenantId, input.tenantId),
          eq(
            customerAuthRefreshTokens.customerAccountId,
            input.customerAccountId,
          ),
          isNull(customerAuthRefreshTokens.revokedAt),
          isNull(customerAuthRefreshTokens.deletedAt),
        ),
      );
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
    if (!order.customerId) {
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
          inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
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
          inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
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
