import {
  and,
  count,
  eq,
  gte,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import {
  appointments,
  deliveryTasks,
  orders,
  paymentTransactions,
  serviceTickets,
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";

import type { OwnerTodaySummary } from "./owner.types.js";

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
}
