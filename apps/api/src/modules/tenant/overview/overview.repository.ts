import { and, count, eq, inArray, isNull, sql, sum } from "drizzle-orm";

import {
  type Database,
  orders,
  serviceTickets,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
} from "@cleanhub/db";

import type { TenantOverview, TenantOverviewBase } from "./overview.types.js";

export async function findTenantOverviewBase(
  db: Database,
  tenantId: string,
): Promise<TenantOverviewBase | null> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
      deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
      notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
      currency: tenantSettings.defaultCurrency,
    })
    .from(tenants)
    .innerJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
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
    currency: row.currency ?? "XOF",
    featureFlags: {
      laundryEnabled: row.laundryEnabled,
      carWashEnabled: row.carWashEnabled,
      retailProductsEnabled: row.retailProductsEnabled,
      deliveryEnabled: row.deliveryEnabled,
      notificationsEnabled: row.notificationsEnabled,
    },
  };
}

/**
 * Today's order volume for a tenant: count and total paid amount, excluding
 * cancelled orders. Uses the UTC day boundary to keep the metric stable across
 * the platform.
 */
export async function findTenantTodayOrderMetrics(
  db: Database,
  tenantId: string,
): Promise<{ orderCount: number; revenueAmount: number }> {
  const rows = await db
    .select({
      orderCount: count(),
      revenueAmount: sum(orders.paidAmount),
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        isNull(orders.deletedAt),
        sql`${orders.createdAt} >= date_trunc('day', now())`,
        sql`${orders.status} <> 'cancelled'`,
      ),
    );

  const orderCount = rows[0]?.orderCount ?? 0;
  const revenueAmount = Number(rows[0]?.revenueAmount ?? 0);

  return { orderCount, revenueAmount };
}

/**
 * Orders that are still being fulfilled for the tenant — received or paid, but
 * not yet delivered or cancelled.
 */
export async function findTenantInProgressOrderCount(
  db: Database,
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        isNull(orders.deletedAt),
        inArray(orders.status, ["received", "paid"]),
      ),
    );

  return rows[0]?.value ?? 0;
}

/**
 * Service tickets that are finished and waiting for the customer to pick up.
 */
export async function findTenantPendingPickupCount(
  db: Database,
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        isNull(serviceTickets.deletedAt),
        eq(serviceTickets.ticketStatus, "ready_to_pick"),
      ),
    );

  return rows[0]?.value ?? 0;
}

/**
 * Service tickets that still require staff work — pending intake or actively
 * being processed. `draft` is excluded because it is not yet committed work.
 */
export async function findTenantPendingTasksCount(
  db: Database,
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        isNull(serviceTickets.deletedAt),
        inArray(serviceTickets.ticketStatus, ["pending", "in_progress"]),
      ),
    );

  return rows[0]?.value ?? 0;
}

export type TenantOverviewMetrics = Pick<
  TenantOverview,
  | "todayOrderCount"
  | "todayRevenueAmount"
  | "pendingPickupCount"
  | "inProgressOrderCount"
  | "pendingTasksCount"
>;
