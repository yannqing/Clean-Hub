import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  sum,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  feedbackTickets,
  orders,
  paymentTransactions,
  posPaymentAdjustments,
  refundRequests,
  restoreRequests,
  securityEvents,
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

export async function findTodoCounts(db: Database): Promise<{
  feedbackTickets: number;
  restoreRequests: number;
  securityEvents: number;
}> {
  const [feedback, restores, security] = await Promise.all([
    db
      .select({ value: count() })
      .from(feedbackTickets)
      .where(
        and(
          inArray(feedbackTickets.status, ["open", "in_progress"]),
          isNull(feedbackTickets.deletedAt),
        ),
      ),
    db
      .select({ value: count() })
      .from(restoreRequests)
      .where(
        and(
          eq(restoreRequests.status, "pending"),
          isNull(restoreRequests.deletedAt),
        ),
      ),
    db
      .select({ value: count() })
      .from(securityEvents)
      .where(inArray(securityEvents.severity, ["high", "critical"])),
  ]);
  return {
    feedbackTickets: feedback[0]?.value ?? 0,
    restoreRequests: restores[0]?.value ?? 0,
    securityEvents: security[0]?.value ?? 0,
  };
}

export async function findBranchCount(db: Database): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(branches)
    .where(isNull(branches.deletedAt));

  return rows[0]?.value ?? 0;
}

function todayFilter(
  column:
    | SQL
    | typeof orders.createdAt
    | typeof paymentTransactions.paidAt
    | typeof refundRequests.refundedAt,
  timezone: string,
) {
  return and(
    sql`${column} >= (date_trunc('day', now() at time zone ${timezone}) at time zone ${timezone})`,
    sql`${column} < ((date_trunc('day', now() at time zone ${timezone}) + interval '1 day') at time zone ${timezone})`,
  );
}

export async function findTodayOrderCount(
  db: Database,
  timezone: string,
): Promise<number> {
  const rows = await db
    .select({ orderCount: count() })
    .from(orders)
    .where(
      and(
        isNull(orders.deletedAt),
        todayFilter(orders.createdAt, timezone),
        sql`${orders.status} <> 'cancelled'`,
      ),
    );

  return rows[0]?.orderCount ?? 0;
}

/** Settled payment cash flow today, net of POS adjustments and refunds. */
export async function findTodayRevenueByCurrency(
  db: Database,
  timezone: string,
): Promise<Array<{ currency: string; amount: number }>> {
  const paymentRows = await db
    .select({
      currency: paymentTransactions.currency,
      amount: sum(paymentTransactions.amount),
    })
    .from(paymentTransactions)
    .where(
      and(
        inArray(paymentTransactions.paymentStatus, ["paid", "refunded"]),
        isNotNull(paymentTransactions.paidAt),
        isNull(paymentTransactions.deletedAt),
        todayFilter(paymentTransactions.paidAt, timezone),
      ),
    )
    .groupBy(paymentTransactions.currency)
    .orderBy(paymentTransactions.currency);

  const adjustmentTime = sql`coalesce(${posPaymentAdjustments.resolvedAt}, ${posPaymentAdjustments.occurredAt})`;
  const adjustmentRows = await db
    .select({
      currency: posPaymentAdjustments.currency,
      amount: sql<string>`sum(case
      when ${posPaymentAdjustments.adjustmentType} = 'refund' and ${posPaymentAdjustments.direction} = 'debit' then -${posPaymentAdjustments.amount}
      when ${posPaymentAdjustments.adjustmentType} = 'refund' and ${posPaymentAdjustments.direction} = 'credit' then ${posPaymentAdjustments.amount}
      when ${posPaymentAdjustments.adjustmentType} = 'correction' and ${posPaymentAdjustments.direction} = 'credit' then ${posPaymentAdjustments.amount}
      else -${posPaymentAdjustments.amount}
    end)::text`,
    })
    .from(posPaymentAdjustments)
    .where(
      and(
        eq(posPaymentAdjustments.status, "succeeded"),
        todayFilter(adjustmentTime, timezone),
      ),
    )
    .groupBy(posPaymentAdjustments.currency);

  const refundRows = await db
    .select({
      currency: refundRequests.currency,
      amount: sum(refundRequests.amount),
    })
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.status, "refunded"),
        isNotNull(refundRequests.refundedAt),
        isNull(refundRequests.deletedAt),
        todayFilter(refundRequests.refundedAt, timezone),
      ),
    )
    .groupBy(refundRequests.currency);

  const totals = new Map<string, number>();
  for (const row of paymentRows) {
    totals.set(
      row.currency,
      (totals.get(row.currency) ?? 0) + Number(row.amount ?? 0),
    );
  }
  for (const row of adjustmentRows) {
    totals.set(
      row.currency,
      (totals.get(row.currency) ?? 0) + Number(row.amount ?? 0),
    );
  }
  for (const row of refundRows) {
    totals.set(
      row.currency,
      (totals.get(row.currency) ?? 0) - Number(row.amount ?? 0),
    );
  }
  return [...totals]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount }));
}
