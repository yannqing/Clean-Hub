import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branches,
  orders,
  paymentTransactions,
  serviceTickets,
  tenantSettings,
  type Database,
} from "@cleanhub/db";
import { sumOrderTaxComponents } from "../../tax/tax-reporting.repository.js";

import type {
  OrderStatusBreakdown,
  PaymentBreakdown,
  ReportAvailableBranch,
  ReportBranchPerformance,
  ReportComparisonMetrics,
  ReportMetricChanges,
  ReportSalesTrendPoint,
  ReportSummary,
  ReportSummaryInput,
} from "./reports.types.js";

type ReportRepositoryInput = ReportSummaryInput & {
  tenantId: string;
  allowedBranchIds?: string[];
  currency: string;
  timezone: string;
  availableCurrencies: string[];
};

type DateRange = {
  from: string | null;
  to: string | null;
};

export type TenantReportContext = {
  defaultCurrency: string;
  timezone: string;
  availableCurrencies: string[];
};

type PaymentMetrics = {
  grossSales: number;
  paidOrderCount: number;
  uniqueCustomerCount: number;
  paymentBreakdown: PaymentBreakdown;
};

type OrderMetrics = {
  orderCount: number;
  taxableAmount: number;
  taxAmount: number;
  orderStatusBreakdown: OrderStatusBreakdown;
};

const EMPTY_PAYMENT_BREAKDOWN: PaymentBreakdown = {
  cash: 0,
  mobile: 0,
  card: 0,
  other: 0,
};

const EMPTY_ORDER_STATUS_BREAKDOWN: OrderStatusBreakdown = {
  draft: 0,
  received: 0,
  paid: 0,
  delivered: 0,
  cancelled: 0,
};

const EMPTY_CHANGES: ReportMetricChanges = {
  grossSales: null,
  orderCount: null,
  averageOrderValue: null,
  uniqueCustomerCount: null,
};

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addCalendarDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function resolveDateRange(input: ReportSummaryInput): DateRange {
  return {
    from: input.from ?? null,
    to: input.to ?? null,
  };
}

function resolvePreviousDateRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) {
    return null;
  }

  const start = parseDateOnly(range.from);
  const end = parseDateOnly(range.to);
  const durationDays =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const previousTo = addCalendarDays(start, -1);
  const previousFrom = addCalendarDays(previousTo, -(durationDays - 1));

  return {
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10),
  };
}

function toNumber(value: number | string | null | undefined): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result) ? result : 0;
}

function toMoney(value: number | string | null | undefined): number {
  return Number(toNumber(value).toFixed(2));
}

function toAverage(total: number, count: number): number {
  return count > 0 ? toMoney(total / count) : 0;
}

function toPercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function applyDateRange(
  filters: SQL[],
  column: typeof orders.createdAt | typeof paymentTransactions.paidAt,
  range: DateRange,
  timezone: string,
): void {
  if (range.from) {
    filters.push(
      sql`${column} >= (${range.from}::date::timestamp at time zone ${timezone})`,
    );
  }

  if (range.to) {
    filters.push(
      sql`${column} < ((${range.to}::date + 1)::timestamp at time zone ${timezone})`,
    );
  }
}

function createPaymentFilters(
  input: ReportRepositoryInput,
  range: DateRange,
): SQL[] {
  const filters: SQL[] = [
    eq(paymentTransactions.tenantId, input.tenantId),
    eq(paymentTransactions.paymentStatus, "paid"),
    eq(paymentTransactions.currency, input.currency),
    isNotNull(paymentTransactions.paidAt),
    isNull(paymentTransactions.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    filters.push(inArray(paymentTransactions.branchId, input.allowedBranchIds));
  }

  if (input.branchId) {
    filters.push(eq(paymentTransactions.branchId, input.branchId));
  }

  applyDateRange(filters, paymentTransactions.paidAt, range, input.timezone);

  return filters;
}

function createOrderFilters(
  input: ReportRepositoryInput,
  range: DateRange,
): SQL[] {
  const filters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    eq(orders.currency, input.currency),
    isNull(orders.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    filters.push(inArray(orders.branchId, input.allowedBranchIds));
  }

  if (input.branchId) {
    filters.push(eq(orders.branchId, input.branchId));
  }

  applyDateRange(filters, orders.createdAt, range, input.timezone);

  return filters;
}

export async function findTenantReportContext(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
  },
): Promise<TenantReportContext> {
  const settingsRows = await db
    .select({
      defaultCurrency: tenantSettings.defaultCurrency,
      timezone: tenantSettings.timezone,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, input.tenantId))
    .limit(1);
  const settings = settingsRows[0];
  const defaultCurrency = settings?.defaultCurrency ?? "XOF";
  const branchFilters: SQL[] = [
    eq(branches.tenantId, input.tenantId),
    isNull(branches.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    if (input.allowedBranchIds.length === 0) {
      return {
        defaultCurrency,
        timezone: settings?.timezone ?? "UTC",
        availableCurrencies: [defaultCurrency],
      };
    }

    branchFilters.push(inArray(branches.id, input.allowedBranchIds));
  }

  const currencyRows = await db
    .select({ currency: branches.defaultCurrency })
    .from(branches)
    .where(and(...branchFilters));
  const currencies = [...new Set(currencyRows.map((row) => row.currency))].sort(
    (left, right) => left.localeCompare(right),
  );

  if (currencies.length === 0) {
    currencies.push(defaultCurrency);
  } else if (currencies.includes(defaultCurrency)) {
    currencies.splice(currencies.indexOf(defaultCurrency), 1);
    currencies.unshift(defaultCurrency);
  }

  return {
    defaultCurrency,
    timezone: settings?.timezone ?? "UTC",
    availableCurrencies: currencies,
  };
}

async function findPaymentMetrics(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<PaymentMetrics> {
  const rows = await db
    .select({
      grossSales: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text`,
      paidOrderCount: sql<number>`count(distinct ${paymentTransactions.orderId})::int`,
      uniqueCustomerCount: sql<number>`count(distinct ${paymentTransactions.customerId})::int`,
      cash: sql<string>`coalesce(sum(${paymentTransactions.amount}) filter (where ${paymentTransactions.paymentMethod} = 'cash'), 0)::text`,
      mobile: sql<string>`coalesce(sum(${paymentTransactions.amount}) filter (where ${paymentTransactions.paymentMethod} = 'app'), 0)::text`,
      card: sql<string>`coalesce(sum(${paymentTransactions.amount}) filter (where ${paymentTransactions.paymentMethod} = 'card'), 0)::text`,
      other: sql<string>`coalesce(sum(${paymentTransactions.amount}) filter (where ${paymentTransactions.paymentMethod} not in ('cash', 'app', 'card')), 0)::text`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)));
  const row = rows[0];

  return {
    grossSales: toMoney(row?.grossSales),
    paidOrderCount: toNumber(row?.paidOrderCount),
    uniqueCustomerCount: toNumber(row?.uniqueCustomerCount),
    paymentBreakdown: {
      cash: toMoney(row?.cash),
      mobile: toMoney(row?.mobile),
      card: toMoney(row?.card),
      other: toMoney(row?.other),
    },
  };
}

async function findOrderMetrics(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<OrderMetrics> {
  const rows = await db
    .select({
      orderCount: sql<number>`count(*) filter (where ${orders.status} in ('received', 'paid', 'delivered'))::int`,
      taxableAmount: sql<string>`coalesce(sum(${orders.taxableAmount}) filter (where ${orders.status} in ('received', 'paid', 'delivered')), 0)::text`,
      taxAmount: sql<string>`coalesce(sum(${orders.taxAmount}) filter (where ${orders.status} in ('received', 'paid', 'delivered')), 0)::text`,
      draft: sql<number>`count(*) filter (where ${orders.status} = 'draft')::int`,
      received: sql<number>`count(*) filter (where ${orders.status} = 'received')::int`,
      paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
    })
    .from(orders)
    .where(and(...createOrderFilters(input, range)));
  const row = rows[0];

  return {
    orderCount: toNumber(row?.orderCount),
    taxableAmount: toMoney(row?.taxableAmount),
    taxAmount: toMoney(row?.taxAmount),
    orderStatusBreakdown: {
      draft: toNumber(row?.draft),
      received: toNumber(row?.received),
      paid: toNumber(row?.paid),
      delivered: toNumber(row?.delivered),
      cancelled: toNumber(row?.cancelled),
    },
  };
}

async function findWorkloadMetrics(
  db: Database,
  input: ReportRepositoryInput,
  generatedAt: Date,
): Promise<{
  pendingPickupCount: number;
  inProgressCount: number;
  overdueCount: number;
}> {
  const filters: SQL[] = [
    eq(serviceTickets.tenantId, input.tenantId),
    inArray(serviceTickets.ticketType, ["laundry", "car_wash"]),
    isNull(serviceTickets.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    filters.push(inArray(serviceTickets.branchId, input.allowedBranchIds));
  }

  if (input.branchId) {
    filters.push(eq(serviceTickets.branchId, input.branchId));
  }

  const rows = await db
    .select({
      pendingPickupCount: sql<number>`count(*) filter (where ${serviceTickets.ticketStatus} = 'ready_to_pick')::int`,
      inProgressCount: sql<number>`count(*) filter (where ${serviceTickets.ticketStatus} in ('pending', 'in_progress'))::int`,
      overdueCount: sql<number>`count(*) filter (
        where ${serviceTickets.expectedPickupAt} < ${generatedAt}
          and ${serviceTickets.ticketStatus} in ('pending', 'in_progress', 'ready_to_pick')
      )::int`,
    })
    .from(serviceTickets)
    .where(and(...filters));
  const row = rows[0];

  return {
    pendingPickupCount: toNumber(row?.pendingPickupCount),
    inProgressCount: toNumber(row?.inProgressCount),
    overdueCount: toNumber(row?.overdueCount),
  };
}

async function findPaymentTrend(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<Array<{ date: string; grossSales: number }>> {
  const date = sql<string>`to_char(${paymentTransactions.paidAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date,
      grossSales: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1 asc"));

  return rows.map((row) => ({
    date: row.date,
    grossSales: toMoney(row.grossSales),
  }));
}

async function findOrderTrend(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<Array<{ date: string; orderCount: number }>> {
  const date = sql<string>`to_char(${orders.createdAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
  const filters = createOrderFilters(input, range);
  filters.push(sql`${orders.status} in ('received', 'paid', 'delivered')`);

  const rows = await db
    .select({
      date,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...filters))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1 asc"));

  return rows.map((row) => ({
    date: row.date,
    orderCount: toNumber(row.orderCount),
  }));
}

async function findAvailableBranches(
  db: Database,
  input: ReportRepositoryInput,
): Promise<ReportAvailableBranch[]> {
  const filters: SQL[] = [
    eq(branches.tenantId, input.tenantId),
    isNull(branches.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    filters.push(inArray(branches.id, input.allowedBranchIds));
  }

  return db
    .select({
      id: branches.id,
      name: branches.name,
    })
    .from(branches)
    .where(and(...filters))
    .orderBy(asc(branches.name), asc(branches.id));
}

async function findBranchPaymentMetrics(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<Array<{ branchId: string; grossSales: number }>> {
  const rows = await db
    .select({
      branchId: paymentTransactions.branchId,
      grossSales: sql<string>`coalesce(sum(${paymentTransactions.amount}), 0)::text`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)))
    .groupBy(paymentTransactions.branchId);

  return rows.map((row) => ({
    branchId: row.branchId,
    grossSales: toMoney(row.grossSales),
  }));
}

async function findBranchOrderMetrics(
  db: Database,
  input: ReportRepositoryInput,
  range: DateRange,
): Promise<Array<{ branchId: string; orderCount: number }>> {
  const filters = createOrderFilters(input, range);
  filters.push(sql`${orders.status} in ('received', 'paid', 'delivered')`);

  const rows = await db
    .select({
      branchId: orders.branchId,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...filters))
    .groupBy(orders.branchId);

  return rows.map((row) => ({
    branchId: row.branchId,
    orderCount: toNumber(row.orderCount),
  }));
}

function combineSalesTrend(
  paymentRows: Array<{ date: string; grossSales: number }>,
  orderRows: Array<{ date: string; orderCount: number }>,
): ReportSalesTrendPoint[] {
  const points = new Map<string, ReportSalesTrendPoint>();

  for (const row of paymentRows) {
    points.set(row.date, {
      date: row.date,
      grossSales: row.grossSales,
      orderCount: 0,
    });
  }

  for (const row of orderRows) {
    const point = points.get(row.date);

    if (point) {
      point.orderCount = row.orderCount;
    } else {
      points.set(row.date, {
        date: row.date,
        grossSales: 0,
        orderCount: row.orderCount,
      });
    }
  }

  return [...points.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function combineBranchPerformance(
  availableBranches: ReportAvailableBranch[],
  selectedBranchId: string | undefined,
  paymentRows: Array<{ branchId: string; grossSales: number }>,
  orderRows: Array<{ branchId: string; orderCount: number }>,
): ReportBranchPerformance[] {
  const paymentByBranch = new Map(
    paymentRows.map((row) => [row.branchId, row.grossSales]),
  );
  const ordersByBranch = new Map(
    orderRows.map((row) => [row.branchId, row.orderCount]),
  );

  return availableBranches
    .filter((branch) => !selectedBranchId || branch.id === selectedBranchId)
    .map((branch) => ({
      branchId: branch.id,
      branchName: branch.name,
      grossSales: paymentByBranch.get(branch.id) ?? 0,
      orderCount: ordersByBranch.get(branch.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.grossSales - left.grossSales ||
        right.orderCount - left.orderCount ||
        left.branchName.localeCompare(right.branchName),
    );
}

function toComparisonMetrics(
  payments: PaymentMetrics,
  orderMetrics: OrderMetrics,
): ReportComparisonMetrics {
  return {
    grossSales: payments.grossSales,
    orderCount: orderMetrics.orderCount,
    averageOrderValue: toAverage(payments.grossSales, payments.paidOrderCount),
    uniqueCustomerCount: payments.uniqueCustomerCount,
  };
}

function createChanges(
  current: ReportComparisonMetrics,
  previous: ReportComparisonMetrics | null,
): ReportMetricChanges {
  if (!previous) {
    return { ...EMPTY_CHANGES };
  }

  return {
    grossSales: toPercentageChange(current.grossSales, previous.grossSales),
    orderCount: toPercentageChange(current.orderCount, previous.orderCount),
    averageOrderValue: toPercentageChange(
      current.averageOrderValue,
      previous.averageOrderValue,
    ),
    uniqueCustomerCount: toPercentageChange(
      current.uniqueCustomerCount,
      previous.uniqueCustomerCount,
    ),
  };
}

function createEmptySummary(
  input: ReportRepositoryInput,
  generatedAt: string,
  includeComparison: boolean,
): ReportSummary {
  const comparison = includeComparison
    ? {
        grossSales: 0,
        orderCount: 0,
        averageOrderValue: 0,
        uniqueCustomerCount: 0,
      }
    : null;

  return {
    currency: input.currency,
    timezone: input.timezone,
    availableCurrencies: input.availableCurrencies,
    grossSales: 0,
    taxableAmount: 0,
    taxAmount: 0,
    taxComponents: [],
    orderCount: 0,
    averageOrderValue: 0,
    uniqueCustomerCount: 0,
    pendingPickupCount: 0,
    inProgressCount: 0,
    overdueCount: 0,
    comparison,
    changes: { ...EMPTY_CHANGES },
    paymentBreakdown: { ...EMPTY_PAYMENT_BREAKDOWN },
    orderStatusBreakdown: { ...EMPTY_ORDER_STATUS_BREAKDOWN },
    salesTrend: [],
    branchPerformance: [],
    availableBranches: [],
    filters: {
      from: input.from ?? null,
      to: input.to ?? null,
      branchId: input.branchId ?? null,
    },
    generatedAt,
  };
}

export async function getTenantReportSummaryRecord(
  db: Database,
  input: ReportRepositoryInput,
): Promise<ReportSummary> {
  const generatedAt = new Date().toISOString();
  const range = resolveDateRange(input);
  const previousRange = resolvePreviousDateRange(range);

  if (
    input.allowedBranchIds !== undefined &&
    input.allowedBranchIds.length === 0
  ) {
    return createEmptySummary(input, generatedAt, previousRange !== null);
  }

  const [
    availableBranches,
    currentPayments,
    currentOrders,
    workload,
    paymentTrend,
  ] = await Promise.all([
    findAvailableBranches(db, input),
    findPaymentMetrics(db, input, range),
    findOrderMetrics(db, input, range),
    findWorkloadMetrics(db, input, new Date(generatedAt)),
    findPaymentTrend(db, input, range),
  ]);
  const taxComponents = await sumOrderTaxComponents(db, [
    ...createOrderFilters(input, range),
    inArray(orders.status, ["received", "paid", "delivered"]),
  ]);
  const [
    orderTrend,
    branchPayments,
    branchOrders,
    previousPayments,
    previousOrders,
  ] = await Promise.all([
    findOrderTrend(db, input, range),
    findBranchPaymentMetrics(db, input, range),
    findBranchOrderMetrics(db, input, range),
    previousRange
      ? findPaymentMetrics(db, input, previousRange)
      : Promise.resolve(null),
    previousRange
      ? findOrderMetrics(db, input, previousRange)
      : Promise.resolve(null),
  ]);
  const current = toComparisonMetrics(currentPayments, currentOrders);
  const comparison =
    previousPayments && previousOrders
      ? toComparisonMetrics(previousPayments, previousOrders)
      : null;

  return {
    currency: input.currency,
    timezone: input.timezone,
    availableCurrencies: input.availableCurrencies,
    ...current,
    taxableAmount: currentOrders.taxableAmount,
    taxAmount: currentOrders.taxAmount,
    taxComponents: taxComponents.map((component) => ({
      ...component,
      taxableAmount: toMoney(component.taxableAmount),
      taxAmount: toMoney(component.taxAmount),
    })),
    pendingPickupCount: workload.pendingPickupCount,
    inProgressCount: workload.inProgressCount,
    overdueCount: workload.overdueCount,
    comparison,
    changes: createChanges(current, comparison),
    paymentBreakdown: currentPayments.paymentBreakdown,
    orderStatusBreakdown: currentOrders.orderStatusBreakdown,
    salesTrend: combineSalesTrend(paymentTrend, orderTrend),
    branchPerformance: combineBranchPerformance(
      availableBranches,
      input.branchId,
      branchPayments,
      branchOrders,
    ),
    availableBranches,
    filters: {
      from: input.from ?? null,
      to: input.to ?? null,
      branchId: input.branchId ?? null,
    },
    generatedAt,
  };
}
