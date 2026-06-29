import {
  type Database,
  customerAccounts,
  customers,
  getDb,
} from "@cleanhub/db";
import {
  type SQL,
  and,
  count,
  eq,
  gte,
  isNull,
  sql,
} from "drizzle-orm";
import { findPosOrderOverview } from "../orders/orders.repository.js";
import { findServiceTicketOverview } from "../service-tickets/service-tickets.repository.js";
import type {
  PosCustomerStatistics,
  PosOrderStatistics,
  PosStatisticsOverview,
  PosStatisticsRepositoryInput,
  PosTicketStatistics,
} from "./statistics.types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPeriodStart(period?: string): Date | null {
  if (!period || period === "all") {
    return null;
  }
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "today") {
    return today;
  }
  if (period === "week") {
    return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  }
  // month
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Customer statistics
// ---------------------------------------------------------------------------

export async function findCustomerStatistics(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
    branchId?: string;
  },
): Promise<PosCustomerStatistics> {
  const baseFilters: SQL[] = [
    eq(customerAccounts.tenantId, input.tenantId),
    isNull(customerAccounts.deletedAt),
  ];

  // Total customer count
  const totalRows = await db
    .select({ value: count() })
    .from(customerAccounts)
    .where(and(...baseFilters));

  // Today's new customers
  const todayUtcStart = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;
  const todayRows = await db
    .select({ value: count() })
    .from(customerAccounts)
    .where(
      and(
        ...baseFilters,
        sql`${customerAccounts.createdAt} >= ${todayUtcStart}`,
      ),
    );

  return {
    totalCount: totalRows[0]?.value ?? 0,
    todayNewCount: todayRows[0]?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregated overview
// ---------------------------------------------------------------------------

export async function findStatisticsOverview(
  db: Database,
  input: PosStatisticsRepositoryInput,
): Promise<PosStatisticsOverview> {
  const [orderOverview, ticketOverview, customerStats] = await Promise.all([
    findPosOrderOverview(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
      period: input.period ?? "today",
    }),
    findServiceTicketOverview(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
    }),
    findCustomerStatistics(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
    }),
  ]);

  const orderStats: PosOrderStatistics = {
    orderCount: orderOverview.orderCount,
    totalAmount: orderOverview.totalAmount,
    paidAmount: orderOverview.paidAmount,
    unpaidCount: orderOverview.unpaidCount,
    deliveredCount: orderOverview.deliveredCount,
    cancelledCount: orderOverview.cancelledCount,
  };

  const ticketStats: PosTicketStatistics = {
    total: Object.values(ticketOverview.byStatus).reduce(
      (sum, count) => sum + (count ?? 0),
      0,
    ),
    byStatus: ticketOverview.byStatus as Record<string, number>,
    overdueCount: ticketOverview.overdueCount,
    todayCreatedCount: ticketOverview.todayCreatedCount,
    todayPickedUpCount: ticketOverview.todayPickedUpCount,
  };

  return {
    orders: orderStats,
    tickets: ticketStats,
    customers: customerStats,
  };
}

// ---------------------------------------------------------------------------
// Detailed ticket statistics
// ---------------------------------------------------------------------------

export async function findTicketStatisticsDetail(
  db: Database,
  input: PosStatisticsRepositoryInput,
): Promise<{
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
  todayCompletedCount: number;
}> {
  const overview = await findServiceTicketOverview(db, {
    tenantId: input.tenantId,
    allowedBranchIds: input.allowedBranchIds,
    branchId: input.branchId,
  });

  return {
    byStatus: overview.byStatus as Record<string, number>,
    byType: {},
    byPriority: {},
    overdueCount: overview.overdueCount,
    todayCreatedCount: overview.todayCreatedCount,
    todayPickedUpCount: overview.todayPickedUpCount,
    todayCompletedCount: overview.todayPickedUpCount,
  };
}

// ---------------------------------------------------------------------------
// Detailed order statistics
// ---------------------------------------------------------------------------

export async function findOrderStatisticsDetail(
  db: Database,
  input: PosStatisticsRepositoryInput,
): Promise<{
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  paymentMethods: Array<{ method: string; amount: string; count: number }>;
  totalAmount: string;
  paidAmount: string;
}> {
  const overview = await findPosOrderOverview(db, {
    tenantId: input.tenantId,
    allowedBranchIds: input.allowedBranchIds,
    branchId: input.branchId,
    period: input.period ?? "today",
  });

  return {
    byStatus: {
      delivered: overview.deliveredCount,
      cancelled: overview.cancelledCount,
    },
    byPaymentStatus: {
      unpaid: overview.unpaidCount,
      partial: overview.partialCount,
      paid: overview.paidCount,
    },
    paymentMethods: overview.paymentMethods,
    totalAmount: overview.totalAmount,
    paidAmount: overview.paidAmount,
  };
}
