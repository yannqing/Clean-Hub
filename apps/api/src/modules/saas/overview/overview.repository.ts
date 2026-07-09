import { and, count, eq, isNull, sql, sum } from "drizzle-orm";

import {
  branches,
  feedbackTickets,
  orders,
  tenants,
  type Database,
} from "@cleanhub/db";

export async function findTenantCounts(db: Database): Promise<{
  total: number;
  active: number;
  suspended: number;
}> {
  const rows = await db
    .select({ status: tenants.status, value: count() })
    .from(tenants)
    .where(isNull(tenants.deletedAt))
    .groupBy(tenants.status);

  let active = 0;
  let suspended = 0;
  let disabled = 0;

  for (const row of rows) {
    if (row.status === "active") active = row.value;
    else if (row.status === "suspended") suspended = row.value;
    else if (row.status === "disabled") disabled = row.value;
  }

  return {
    total: active + suspended + disabled,
    active,
    suspended,
  };
}

export async function findPendingFeedbackCount(db: Database): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(feedbackTickets)
    .where(and(eq(feedbackTickets.status, "open"), isNull(feedbackTickets.deletedAt)));

  return rows[0]?.value ?? 0;
}

export async function findBranchCount(db: Database): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(branches)
    .where(isNull(branches.deletedAt));

  return rows[0]?.value ?? 0;
}

/**
 * Returns the count and total revenue of non-cancelled orders created today
 * (UTC day boundary). `paidAmount` is summed so partially paid orders are
 * reflected accurately in platform revenue.
 */
export async function findTodayOrderMetrics(db: Database): Promise<{
  orderCount: number;
  revenueAmount: number;
}> {
  const rows = await db
    .select({
      orderCount: count(),
      revenueAmount: sum(orders.paidAmount),
    })
    .from(orders)
    .where(
      and(
        isNull(orders.deletedAt),
        sql`${orders.createdAt} >= date_trunc('day', now())`,
        sql`${orders.status} <> 'cancelled'`,
      ),
    );

  const orderCount = rows[0]?.orderCount ?? 0;
  const revenueAmount = Number(rows[0]?.revenueAmount ?? 0);

  return { orderCount, revenueAmount };
}
