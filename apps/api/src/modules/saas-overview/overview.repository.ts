import { and, count, eq, isNull } from "drizzle-orm";

import { feedbackTickets, tenants, type Database } from "@cleanhub/db";

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
