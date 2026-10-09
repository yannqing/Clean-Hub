import {
  type Database,
  customerAccounts,
  customers,
  orders,
  serviceTickets,
} from "@cleanhub/db";
import {
  addCalendarDays,
  getDateOnlyInTimeZone,
} from "@cleanhub/domain/timezone";
import {
  type SQL,
  and,
  eq,
  inArray,
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
// Customer statistics
// ---------------------------------------------------------------------------

function getLastSevenDates(timeZone: string): string[] {
  const today = getDateOnlyInTimeZone(new Date(), timeZone);
  return Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(today, -(6 - index)),
  );
}

export async function findCustomerStatistics(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
    branchId?: string;
    timeZone: string;
  },
): Promise<PosCustomerStatistics> {
  if (input.allowedBranchIds?.length === 0) {
    return {
      totalCount: 0,
      todayNewCount: 0,
      activeCount: 0,
      disabledCount: 0,
      profileCount: 0,
      activeProfileCount: 0,
      disabledProfileCount: 0,
      todayNewProfileCount: 0,
      orderedCustomerCount: 0,
      ticketedCustomerCount: 0,
      engagedCustomerCount: 0,
      repeatOrderCustomerCount: 0,
      repeatTicketCustomerCount: 0,
      sevenDayNewAccounts: getLastSevenDates(input.timeZone).map((date) => ({
        date,
        count: 0,
      })),
    };
  }

  const baseFilters: SQL[] = [
    eq(customerAccounts.tenantId, input.tenantId),
    isNull(customerAccounts.deletedAt),
  ];
  const profileFilters: SQL[] = [
    eq(customers.tenantId, input.tenantId),
    isNull(customers.deletedAt),
  ];

  const accountSummaryRows = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      activeCount: sql<number>`count(*) filter (where ${customerAccounts.status} = 'active')::int`,
      disabledCount: sql<number>`count(*) filter (where ${customerAccounts.status} = 'disabled')::int`,
    })
    .from(customerAccounts)
    .where(and(...baseFilters));

  const todayStart = sql`date_trunc('day', now() AT TIME ZONE ${input.timeZone}) AT TIME ZONE ${input.timeZone}`;
  const sevenDayStart = sql`(date_trunc('day', now() AT TIME ZONE ${input.timeZone}) - interval '6 days') AT TIME ZONE ${input.timeZone}`;
  const accountCreatedDate = sql<string>`to_char(${customerAccounts.createdAt} AT TIME ZONE ${input.timeZone}, 'YYYY-MM-DD')`;

  const [todayRows, profileSummaryRows, dailyRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(customerAccounts)
      .where(
        and(
          ...baseFilters,
          sql`${customerAccounts.createdAt} >= ${todayStart}`,
        ),
      ),
    db
      .select({
        profileCount: sql<number>`count(*)::int`,
        activeProfileCount: sql<number>`count(*) filter (where ${customers.status} = 'active')::int`,
        disabledProfileCount: sql<number>`count(*) filter (where ${customers.status} = 'disabled')::int`,
        todayNewProfileCount: sql<number>`count(*) filter (where ${customers.createdAt} >= ${todayStart})::int`,
      })
      .from(customers)
      .where(and(...profileFilters)),
    db
      .select({
        date: accountCreatedDate,
        count: sql<number>`count(*)::int`,
      })
      .from(customerAccounts)
      .where(
        and(
          ...baseFilters,
          sql`${customerAccounts.createdAt} >= ${sevenDayStart}`,
        ),
      )
      .groupBy(sql`1`),
  ]);

  const orderFilters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    isNull(orders.deletedAt),
  ];
  const ticketFilters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];
  let hasBranchScope = true;

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      hasBranchScope = false;
    } else {
      orderFilters.push(inArray(orders.branchId, input.allowedBranchIds));
      ticketFilters.push(
        inArray(serviceTickets.branchId, input.allowedBranchIds),
      );
    }
  }

  if (input.branchId) {
    orderFilters.push(eq(orders.branchId, input.branchId));
    ticketFilters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const [orderCustomerRows, ticketCustomerRows] = hasBranchScope
    ? await Promise.all([
        db
          .select({
            customerId: orders.customerId,
            count: sql<number>`count(*)::int`,
          })
          .from(orders)
          .where(and(...orderFilters))
          .groupBy(orders.customerId),
        db
          .select({
            customerId: serviceTickets.customerId,
            count: sql<number>`count(*)::int`,
          })
          .from(serviceTickets)
          .where(and(...ticketFilters))
          .groupBy(serviceTickets.customerId),
      ])
    : [[], []];

  const accountSummary = accountSummaryRows[0];
  const profileSummary = profileSummaryRows[0];
  const dailyCounts = new Map(dailyRows.map((row) => [row.date, row.count]));
  const engagedCustomerIds = new Set<string>();
  for (const row of orderCustomerRows) {
    if (row.customerId) {
      engagedCustomerIds.add(row.customerId);
    }
  }
  for (const row of ticketCustomerRows) {
    engagedCustomerIds.add(row.customerId);
  }

  return {
    totalCount: accountSummary?.totalCount ?? 0,
    todayNewCount: todayRows[0]?.value ?? 0,
    activeCount: accountSummary?.activeCount ?? 0,
    disabledCount: accountSummary?.disabledCount ?? 0,
    profileCount: profileSummary?.profileCount ?? 0,
    activeProfileCount: profileSummary?.activeProfileCount ?? 0,
    disabledProfileCount: profileSummary?.disabledProfileCount ?? 0,
    todayNewProfileCount: profileSummary?.todayNewProfileCount ?? 0,
    orderedCustomerCount: orderCustomerRows.length,
    ticketedCustomerCount: ticketCustomerRows.length,
    engagedCustomerCount: engagedCustomerIds.size,
    repeatOrderCustomerCount: orderCustomerRows.filter((row) => row.count >= 2)
      .length,
    repeatTicketCustomerCount: ticketCustomerRows.filter((row) => row.count >= 2)
      .length,
    sevenDayNewAccounts: getLastSevenDates(input.timeZone).map((date) => ({
      date,
      count: dailyCounts.get(date) ?? 0,
    })),
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
      timeZone: input.timeZone,
    }),
    findServiceTicketOverview(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
      timeZone: input.timeZone,
    }),
    findCustomerStatistics(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      branchId: input.branchId,
      timeZone: input.timeZone,
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
    timeZone: input.timeZone,
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
    timeZone: input.timeZone,
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
