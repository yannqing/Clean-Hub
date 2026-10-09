import {
  and,
  asc,
  desc,
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
  posPaymentAdjustments,
  refundRequests,
  tenantSettings,
  type Database,
} from "@cleanhub/db";
import { sumOrderTaxComponents } from "../../tax/tax-reporting.repository.js";

import type {
  FinanceAvailableBranch,
  FinanceBranchPerformance,
  FinanceDailyTrendPoint,
  FinancePaymentMethod,
  FinancePaymentMethodMetrics,
  FinanceSummary,
  FinanceSummaryInput,
  FinanceSummaryMetrics,
  FinanceTransaction,
} from "./finance.types.js";

type FinanceRepositoryInput = FinanceSummaryInput & {
  tenantId: string;
  allowedBranchIds?: string[];
  currency: string;
  timezone: string;
  availableCurrencies: string[];
  availableBranches: FinanceAvailableBranch[];
  from: string;
  to: string;
};

type DateRange = {
  from: string;
  to: string;
};

type LedgerMetrics = {
  grossCollected: number;
  refundAmount: number;
  correctionAmount: number;
  transactionCount: number;
  refundTransactionCount: number;
};

type MethodLedgerRow = Partial<LedgerMetrics> & {
  method: FinancePaymentMethod;
};

type BranchLedgerRow = Partial<LedgerMetrics> & {
  branchId: string;
};

type DailyLedgerRow = Partial<LedgerMetrics> & {
  date: string;
};

export type TenantFinanceContext = {
  defaultCurrency: string;
  timezone: string;
  availableCurrencies: string[];
  availableBranches: FinanceAvailableBranch[];
};

const RECENT_TRANSACTION_LIMIT = 20;
const PAYMENT_METHOD_ORDER: FinancePaymentMethod[] = [
  "cash",
  "card",
  "app",
  "unknown",
];

function toNumber(value: number | string | null | undefined): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result) ? result : 0;
}

function toMoney(value: number | string | null | undefined): number {
  return Number(toNumber(value).toFixed(2));
}

function normalizePaymentMethod(
  value: string | null | undefined,
): FinancePaymentMethod {
  if (value === "cash" || value === "card" || value === "app") {
    return value;
  }

  return "unknown";
}

function emptyLedger(): LedgerMetrics {
  return {
    grossCollected: 0,
    refundAmount: 0,
    correctionAmount: 0,
    transactionCount: 0,
    refundTransactionCount: 0,
  };
}

function addLedger(
  target: LedgerMetrics,
  source: Partial<LedgerMetrics>,
): void {
  target.grossCollected += source.grossCollected ?? 0;
  target.refundAmount += source.refundAmount ?? 0;
  target.correctionAmount += source.correctionAmount ?? 0;
  target.transactionCount += source.transactionCount ?? 0;
  target.refundTransactionCount += source.refundTransactionCount ?? 0;
}

function applyDateRange(
  filters: SQL[],
  column:
    | typeof paymentTransactions.paidAt
    | typeof refundRequests.refundedAt
    | typeof posPaymentAdjustments.occurredAt
    | typeof orders.createdAt,
  range: DateRange,
  timezone: string,
): void {
  filters.push(
    sql`${column} >= (${range.from}::date::timestamp at time zone ${timezone})`,
    sql`${column} < ((${range.to}::date + 1)::timestamp at time zone ${timezone})`,
  );
}

function applyBranchScope(
  filters: SQL[],
  input: FinanceRepositoryInput,
  column:
    | typeof paymentTransactions.branchId
    | typeof refundRequests.branchId
    | typeof posPaymentAdjustments.branchId
    | typeof orders.branchId,
): void {
  if (input.allowedBranchIds !== undefined) {
    filters.push(inArray(column, input.allowedBranchIds));
  }

  if (input.branchId) {
    filters.push(eq(column, input.branchId));
  }
}

function createPaymentFilters(
  input: FinanceRepositoryInput,
  range: DateRange,
): SQL[] {
  const filters: SQL[] = [
    eq(paymentTransactions.tenantId, input.tenantId),
    inArray(paymentTransactions.paymentStatus, ["paid", "refunded"]),
    eq(paymentTransactions.currency, input.currency),
    isNotNull(paymentTransactions.paidAt),
    isNull(paymentTransactions.deletedAt),
  ];

  applyBranchScope(filters, input, paymentTransactions.branchId);
  applyDateRange(filters, paymentTransactions.paidAt, range, input.timezone);

  return filters;
}

function createRefundFilters(
  input: FinanceRepositoryInput,
  range: DateRange,
): SQL[] {
  const filters: SQL[] = [
    eq(refundRequests.tenantId, input.tenantId),
    eq(refundRequests.status, "refunded"),
    eq(refundRequests.currency, input.currency),
    isNotNull(refundRequests.refundedAt),
    isNull(refundRequests.deletedAt),
  ];

  applyBranchScope(filters, input, refundRequests.branchId);
  applyDateRange(filters, refundRequests.refundedAt, range, input.timezone);

  return filters;
}

function createAdjustmentFilters(
  input: FinanceRepositoryInput,
  range: DateRange,
): SQL[] {
  const filters: SQL[] = [
    eq(posPaymentAdjustments.tenantId, input.tenantId),
    eq(posPaymentAdjustments.currency, input.currency),
  ];

  applyBranchScope(filters, input, posPaymentAdjustments.branchId);
  applyDateRange(
    filters,
    posPaymentAdjustments.occurredAt,
    range,
    input.timezone,
  );

  return filters;
}

function toContextCurrencies(
  defaultCurrency: string,
  rows: Array<Array<{ currency: string }>>,
): string[] {
  const currencies = new Set<string>([defaultCurrency]);

  for (const group of rows) {
    for (const row of group) {
      currencies.add(row.currency);
    }
  }

  return [...currencies].sort((left, right) => {
    if (left === defaultCurrency) return -1;
    if (right === defaultCurrency) return 1;
    return left.localeCompare(right);
  });
}

export async function findTenantFinanceContext(
  db: Database,
  input: {
    tenantId: string;
    allowedBranchIds?: string[];
  },
): Promise<TenantFinanceContext> {
  const branchFilters: SQL[] = [
    eq(branches.tenantId, input.tenantId),
    isNull(branches.deletedAt),
  ];

  if (input.allowedBranchIds !== undefined) {
    branchFilters.push(inArray(branches.id, input.allowedBranchIds));
  }

  const [settingsRows, branchRows] = await Promise.all([
    db
      .select({
        defaultCurrency: tenantSettings.defaultCurrency,
        timezone: tenantSettings.timezone,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, input.tenantId))
      .limit(1),
    input.allowedBranchIds !== undefined && input.allowedBranchIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: branches.id,
            name: branches.name,
            currency: branches.defaultCurrency,
          })
          .from(branches)
          .where(and(...branchFilters))
          .orderBy(asc(branches.name), asc(branches.id)),
  ]);
  const settings = settingsRows[0];
  const defaultCurrency = settings?.defaultCurrency ?? "XOF";
  const availableBranches = branchRows.map((branch) => ({
    id: branch.id,
    name: branch.name,
  }));
  const branchIds = branchRows.map((branch) => branch.id);

  if (branchIds.length === 0) {
    return {
      defaultCurrency,
      timezone: settings?.timezone ?? "UTC",
      availableCurrencies: [defaultCurrency],
      availableBranches,
    };
  }

  const [
    paymentCurrencies,
    refundCurrencies,
    adjustmentCurrencies,
    orderCurrencies,
  ] = await Promise.all([
    db
      .selectDistinct({ currency: paymentTransactions.currency })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.tenantId, input.tenantId),
          inArray(paymentTransactions.branchId, branchIds),
          isNull(paymentTransactions.deletedAt),
        ),
      ),
    db
      .selectDistinct({ currency: refundRequests.currency })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.tenantId, input.tenantId),
          inArray(refundRequests.branchId, branchIds),
          isNull(refundRequests.deletedAt),
        ),
      ),
    db
      .selectDistinct({ currency: posPaymentAdjustments.currency })
      .from(posPaymentAdjustments)
      .where(
        and(
          eq(posPaymentAdjustments.tenantId, input.tenantId),
          inArray(posPaymentAdjustments.branchId, branchIds),
        ),
      ),
    db
      .selectDistinct({ currency: orders.currency })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, input.tenantId),
          inArray(orders.branchId, branchIds),
          isNull(orders.deletedAt),
        ),
      ),
  ]);

  return {
    defaultCurrency,
    timezone: settings?.timezone ?? "UTC",
    availableCurrencies: toContextCurrencies(defaultCurrency, [
      branchRows,
      paymentCurrencies,
      refundCurrencies,
      adjustmentCurrencies,
      orderCurrencies,
    ]),
    availableBranches,
  };
}

async function findPaymentMethodPayments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<MethodLedgerRow[]> {
  const rows = await db
    .select({
      method: paymentTransactions.paymentMethod,
      grossCollected: sql<string>`coalesce(sum(
        case when ${paymentTransactions.amount} > 0
          then ${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${paymentTransactions.paymentStatus} = 'refunded'
            and ${paymentTransactions.amount} < 0
            then -${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${paymentTransactions.paymentStatus} = 'refunded'
          and ${paymentTransactions.amount} < 0
      )::int`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)))
    .groupBy(paymentTransactions.paymentMethod);

  return rows.map((row) => ({
    method: normalizePaymentMethod(row.method),
    grossCollected: toMoney(row.grossCollected),
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findPaymentMethodAdjustments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<MethodLedgerRow[]> {
  const rows = await db
    .select({
      method: paymentTransactions.paymentMethod,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'refund'
            then case when ${posPaymentAdjustments.direction} = 'debit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      correctionAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'correction'
            then case when ${posPaymentAdjustments.direction} = 'credit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${posPaymentAdjustments.adjustmentType} = 'refund'
      )::int`,
    })
    .from(posPaymentAdjustments)
    .leftJoin(
      paymentTransactions,
      and(
        eq(paymentTransactions.id, posPaymentAdjustments.originalPaymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
      ),
    )
    .where(and(...createAdjustmentFilters(input, range)))
    .groupBy(paymentTransactions.paymentMethod);

  return rows.map((row) => ({
    method: normalizePaymentMethod(row.method),
    refundAmount: toMoney(row.refundAmount),
    correctionAmount: toMoney(row.correctionAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findPaymentMethodRefunds(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<MethodLedgerRow[]> {
  const rows = await db
    .select({
      method: paymentTransactions.paymentMethod,
      refundAmount: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(refundRequests)
    .leftJoin(
      paymentTransactions,
      and(
        eq(paymentTransactions.id, refundRequests.paymentTransactionId),
        eq(paymentTransactions.tenantId, input.tenantId),
      ),
    )
    .where(and(...createRefundFilters(input, range)))
    .groupBy(paymentTransactions.paymentMethod);

  return rows.map((row) => ({
    method: normalizePaymentMethod(row.method),
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.transactionCount),
  }));
}

async function findPaidOrderCount(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`count(distinct ${paymentTransactions.orderId}) filter (
        where ${paymentTransactions.amount} > 0
      )::int`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)));

  return toNumber(rows[0]?.count);
}

async function findOrderTaxMetrics(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<{ taxableAmount: number; taxAmount: number; components: Array<{ name: string; rate: string; taxableAmount: number; taxAmount: number }> }> {
  const filters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    eq(orders.currency, input.currency),
    inArray(orders.status, ["received", "paid", "delivered"]),
    isNull(orders.deletedAt),
  ];
  applyBranchScope(filters, input, orders.branchId);
  applyDateRange(filters, orders.createdAt, range, input.timezone);
  const [row] = await db.select({
    taxableAmount: sql<string>`coalesce(sum(${orders.taxableAmount}), 0)::text`,
    taxAmount: sql<string>`coalesce(sum(${orders.taxAmount}), 0)::text`,
  }).from(orders).where(and(...filters));
  const components = await sumOrderTaxComponents(db, filters);
  return {
    taxableAmount: toMoney(row?.taxableAmount),
    taxAmount: toMoney(row?.taxAmount),
    components: components.map((component) => ({ ...component,
      taxableAmount: toMoney(component.taxableAmount), taxAmount: toMoney(component.taxAmount),
    })),
  };
}

async function findPendingRefundMetrics(
  db: Database,
  input: FinanceRepositoryInput,
): Promise<{ amount: number; count: number }> {
  const filters: SQL[] = [
    eq(refundRequests.tenantId, input.tenantId),
    inArray(refundRequests.status, ["pending", "approved", "processing"]),
    eq(refundRequests.currency, input.currency),
    isNull(refundRequests.deletedAt),
  ];

  applyBranchScope(filters, input, refundRequests.branchId);

  const rows = await db
    .select({
      amount: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(refundRequests)
    .where(and(...filters));

  return {
    amount: toMoney(rows[0]?.amount),
    count: toNumber(rows[0]?.count),
  };
}

async function findOutstandingOrderMetrics(
  db: Database,
  input: FinanceRepositoryInput,
): Promise<{ amount: number; count: number }> {
  const filters: SQL[] = [
    eq(orders.tenantId, input.tenantId),
    eq(orders.currency, input.currency),
    inArray(orders.status, ["received", "paid", "delivered"]),
    inArray(orders.paymentStatus, ["unpaid", "partial"]),
    isNull(orders.deletedAt),
  ];

  applyBranchScope(filters, input, orders.branchId);

  const rows = await db
    .select({
      amount: sql<string>`coalesce(sum(greatest(${orders.totalAmount} - ${orders.paidAmount}, 0)), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(...filters));

  return {
    amount: toMoney(rows[0]?.amount),
    count: toNumber(rows[0]?.count),
  };
}

async function findBranchPayments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<BranchLedgerRow[]> {
  const rows = await db
    .select({
      branchId: paymentTransactions.branchId,
      grossCollected: sql<string>`coalesce(sum(
        case when ${paymentTransactions.amount} > 0
          then ${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${paymentTransactions.paymentStatus} = 'refunded'
            and ${paymentTransactions.amount} < 0
            then -${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${paymentTransactions.paymentStatus} = 'refunded'
          and ${paymentTransactions.amount} < 0
      )::int`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)))
    .groupBy(paymentTransactions.branchId);

  return rows.map((row) => ({
    branchId: row.branchId,
    grossCollected: toMoney(row.grossCollected),
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findBranchAdjustments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<BranchLedgerRow[]> {
  const rows = await db
    .select({
      branchId: posPaymentAdjustments.branchId,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'refund'
            then case when ${posPaymentAdjustments.direction} = 'debit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      correctionAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'correction'
            then case when ${posPaymentAdjustments.direction} = 'credit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${posPaymentAdjustments.adjustmentType} = 'refund'
      )::int`,
    })
    .from(posPaymentAdjustments)
    .where(and(...createAdjustmentFilters(input, range)))
    .groupBy(posPaymentAdjustments.branchId);

  return rows.map((row) => ({
    branchId: row.branchId,
    refundAmount: toMoney(row.refundAmount),
    correctionAmount: toMoney(row.correctionAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findBranchRefunds(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<BranchLedgerRow[]> {
  const rows = await db
    .select({
      branchId: refundRequests.branchId,
      refundAmount: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(refundRequests)
    .where(and(...createRefundFilters(input, range)))
    .groupBy(refundRequests.branchId);

  return rows.map((row) => ({
    branchId: row.branchId,
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.transactionCount),
  }));
}

async function findDailyPayments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<DailyLedgerRow[]> {
  const date = sql<string>`to_char(${paymentTransactions.paidAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date,
      grossCollected: sql<string>`coalesce(sum(
        case when ${paymentTransactions.amount} > 0
          then ${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${paymentTransactions.paymentStatus} = 'refunded'
            and ${paymentTransactions.amount} < 0
            then -${paymentTransactions.amount}
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${paymentTransactions.paymentStatus} = 'refunded'
          and ${paymentTransactions.amount} < 0
      )::int`,
    })
    .from(paymentTransactions)
    .where(and(...createPaymentFilters(input, range)))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1 asc"));

  return rows.map((row) => ({
    date: row.date,
    grossCollected: toMoney(row.grossCollected),
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findDailyAdjustments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<DailyLedgerRow[]> {
  const date = sql<string>`to_char(${posPaymentAdjustments.occurredAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date,
      refundAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'refund'
            then case when ${posPaymentAdjustments.direction} = 'debit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      correctionAmount: sql<string>`coalesce(sum(
        case
          when ${posPaymentAdjustments.adjustmentType} = 'correction'
            then case when ${posPaymentAdjustments.direction} = 'credit'
              then ${posPaymentAdjustments.amount}
              else -${posPaymentAdjustments.amount}
            end
          else 0
        end
      ), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
      refundTransactionCount: sql<number>`count(*) filter (
        where ${posPaymentAdjustments.adjustmentType} = 'refund'
      )::int`,
    })
    .from(posPaymentAdjustments)
    .where(and(...createAdjustmentFilters(input, range)))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1 asc"));

  return rows.map((row) => ({
    date: row.date,
    refundAmount: toMoney(row.refundAmount),
    correctionAmount: toMoney(row.correctionAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.refundTransactionCount),
  }));
}

async function findDailyRefunds(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<DailyLedgerRow[]> {
  const date = sql<string>`to_char(${refundRequests.refundedAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date,
      refundAmount: sql<string>`coalesce(sum(${refundRequests.amount}), 0)::text`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(refundRequests)
    .where(and(...createRefundFilters(input, range)))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1 asc"));

  return rows.map((row) => ({
    date: row.date,
    refundAmount: toMoney(row.refundAmount),
    transactionCount: toNumber(row.transactionCount),
    refundTransactionCount: toNumber(row.transactionCount),
  }));
}

async function findRecentPayments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<FinanceTransaction[]> {
  const rows = await db
    .select({
      id: paymentTransactions.id,
      branchId: paymentTransactions.branchId,
      branchName: branches.name,
      orderId: paymentTransactions.orderId,
      amount: paymentTransactions.amount,
      method: paymentTransactions.paymentMethod,
      status: paymentTransactions.paymentStatus,
      occurredAt: paymentTransactions.paidAt,
    })
    .from(paymentTransactions)
    .innerJoin(
      branches,
      and(
        eq(branches.id, paymentTransactions.branchId),
        eq(branches.tenantId, input.tenantId),
        isNull(branches.deletedAt),
      ),
    )
    .where(and(...createPaymentFilters(input, range)))
    .orderBy(desc(paymentTransactions.paidAt), desc(paymentTransactions.id))
    .limit(RECENT_TRANSACTION_LIMIT);

  return rows.flatMap((row) =>
    row.occurredAt
      ? [
          {
            id: row.id,
            source: "payment_transaction" as const,
            kind:
              row.status === "refunded" && toNumber(row.amount) < 0
                ? ("refund" as const)
                : ("payment" as const),
            direction:
              row.status === "refunded" && toNumber(row.amount) < 0
                ? ("debit" as const)
                : ("credit" as const),
            status:
              row.status === "refunded" && toNumber(row.amount) < 0
                ? ("refunded" as const)
                : ("paid" as const),
            amount: toMoney(Math.abs(toNumber(row.amount))),
            currency: input.currency,
            paymentMethod: normalizePaymentMethod(row.method),
            branchId: row.branchId,
            branchName: row.branchName,
            orderId: row.orderId,
            occurredAt: row.occurredAt.toISOString(),
          },
        ]
      : [],
  );
}

async function findRecentAdjustments(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<FinanceTransaction[]> {
  const rows = await db
    .select({
      id: posPaymentAdjustments.id,
      branchId: posPaymentAdjustments.branchId,
      branchName: branches.name,
      orderId: posPaymentAdjustments.orderId,
      amount: posPaymentAdjustments.amount,
      kind: posPaymentAdjustments.adjustmentType,
      direction: posPaymentAdjustments.direction,
      method: paymentTransactions.paymentMethod,
      occurredAt: posPaymentAdjustments.occurredAt,
    })
    .from(posPaymentAdjustments)
    .innerJoin(
      branches,
      and(
        eq(branches.id, posPaymentAdjustments.branchId),
        eq(branches.tenantId, input.tenantId),
        isNull(branches.deletedAt),
      ),
    )
    .leftJoin(
      paymentTransactions,
      and(
        eq(paymentTransactions.id, posPaymentAdjustments.originalPaymentId),
        eq(paymentTransactions.tenantId, input.tenantId),
      ),
    )
    .where(and(...createAdjustmentFilters(input, range)))
    .orderBy(
      desc(posPaymentAdjustments.occurredAt),
      desc(posPaymentAdjustments.id),
    )
    .limit(RECENT_TRANSACTION_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    source: "pos_payment_adjustment",
    kind: row.kind,
    direction: row.direction,
    status: "completed",
    amount: toMoney(row.amount),
    currency: input.currency,
    paymentMethod: normalizePaymentMethod(row.method),
    branchId: row.branchId,
    branchName: row.branchName,
    orderId: row.orderId,
    occurredAt: row.occurredAt.toISOString(),
  }));
}

async function findRecentRefunds(
  db: Database,
  input: FinanceRepositoryInput,
  range: DateRange,
): Promise<FinanceTransaction[]> {
  const rows = await db
    .select({
      id: refundRequests.id,
      branchId: refundRequests.branchId,
      branchName: branches.name,
      orderId: refundRequests.orderId,
      amount: refundRequests.amount,
      method: paymentTransactions.paymentMethod,
      occurredAt: refundRequests.refundedAt,
    })
    .from(refundRequests)
    .innerJoin(
      branches,
      and(
        eq(branches.id, refundRequests.branchId),
        eq(branches.tenantId, input.tenantId),
        isNull(branches.deletedAt),
      ),
    )
    .leftJoin(
      paymentTransactions,
      and(
        eq(paymentTransactions.id, refundRequests.paymentTransactionId),
        eq(paymentTransactions.tenantId, input.tenantId),
      ),
    )
    .where(and(...createRefundFilters(input, range)))
    .orderBy(desc(refundRequests.refundedAt), desc(refundRequests.id))
    .limit(RECENT_TRANSACTION_LIMIT);

  return rows.flatMap((row) =>
    row.occurredAt
      ? [
          {
            id: row.id,
            source: "refund_request" as const,
            kind: "refund" as const,
            direction: "debit" as const,
            status: "refunded" as const,
            amount: toMoney(row.amount),
            currency: input.currency,
            paymentMethod: normalizePaymentMethod(row.method),
            branchId: row.branchId,
            branchName: row.branchName,
            orderId: row.orderId,
            occurredAt: row.occurredAt.toISOString(),
          },
        ]
      : [],
  );
}

function combinePaymentMethods(
  groups: MethodLedgerRow[][],
): FinancePaymentMethodMetrics[] {
  const metrics = new Map<FinancePaymentMethod, LedgerMetrics>(
    PAYMENT_METHOD_ORDER.map((method) => [method, emptyLedger()]),
  );

  for (const rows of groups) {
    for (const row of rows) {
      addLedger(metrics.get(row.method)!, row);
    }
  }

  return PAYMENT_METHOD_ORDER.flatMap((method) => {
    const value = metrics.get(method)!;

    if (
      value.transactionCount === 0 &&
      value.grossCollected === 0 &&
      value.refundAmount === 0 &&
      value.correctionAmount === 0
    ) {
      return [];
    }

    const grossCollected = toMoney(value.grossCollected);
    const refundAmount = toMoney(value.refundAmount);
    const correctionAmount = toMoney(value.correctionAmount);

    return [
      {
        method,
        grossCollected,
        refundAmount,
        correctionAmount,
        netCollected: toMoney(grossCollected - refundAmount + correctionAmount),
        transactionCount: value.transactionCount,
      },
    ];
  });
}

function createSummary(
  paymentMethods: FinancePaymentMethodMetrics[],
  methodGroups: MethodLedgerRow[][],
  paidOrderCount: number,
  pendingRefunds: { amount: number; count: number },
  outstandingOrders: { amount: number; count: number },
): Omit<FinanceSummaryMetrics, "orderTaxableAmount" | "orderTaxAmount" | "orderTaxComponents"> {
  const ledger = emptyLedger();

  for (const group of methodGroups) {
    for (const row of group) {
      addLedger(ledger, row);
    }
  }

  const grossCollected = toMoney(
    paymentMethods.reduce((total, item) => total + item.grossCollected, 0),
  );
  const refundAmount = toMoney(
    paymentMethods.reduce((total, item) => total + item.refundAmount, 0),
  );
  const correctionAmount = toMoney(
    paymentMethods.reduce((total, item) => total + item.correctionAmount, 0),
  );

  return {
    grossCollected,
    refundAmount,
    correctionAmount,
    netCollected: toMoney(grossCollected - refundAmount + correctionAmount),
    transactionCount: ledger.transactionCount,
    paidOrderCount,
    refundTransactionCount: ledger.refundTransactionCount,
    pendingRefundAmount: pendingRefunds.amount,
    pendingRefundCount: pendingRefunds.count,
    outstandingOrderAmount: outstandingOrders.amount,
    outstandingOrderCount: outstandingOrders.count,
  };
}

function combineBranchPerformance(
  input: FinanceRepositoryInput,
  groups: BranchLedgerRow[][],
): FinanceBranchPerformance[] {
  const metrics = new Map<string, LedgerMetrics>();

  for (const rows of groups) {
    for (const row of rows) {
      const ledger = metrics.get(row.branchId) ?? emptyLedger();
      addLedger(ledger, row);
      metrics.set(row.branchId, ledger);
    }
  }

  return input.availableBranches
    .filter((branch) => !input.branchId || branch.id === input.branchId)
    .map((branch) => {
      const ledger = metrics.get(branch.id) ?? emptyLedger();
      const grossCollected = toMoney(ledger.grossCollected);
      const refundAmount = toMoney(ledger.refundAmount);
      const correctionAmount = toMoney(ledger.correctionAmount);

      return {
        branchId: branch.id,
        branchName: branch.name,
        grossCollected,
        refundAmount,
        correctionAmount,
        netCollected: toMoney(grossCollected - refundAmount + correctionAmount),
        transactionCount: ledger.transactionCount,
      };
    })
    .sort(
      (left, right) =>
        right.netCollected - left.netCollected ||
        right.grossCollected - left.grossCollected ||
        left.branchName.localeCompare(right.branchName),
    );
}

function combineDailyTrend(
  groups: DailyLedgerRow[][],
): FinanceDailyTrendPoint[] {
  const metrics = new Map<string, LedgerMetrics>();

  for (const rows of groups) {
    for (const row of rows) {
      const ledger = metrics.get(row.date) ?? emptyLedger();
      addLedger(ledger, row);
      metrics.set(row.date, ledger);
    }
  }

  return [...metrics.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, ledger]) => {
      const grossCollected = toMoney(ledger.grossCollected);
      const refundAmount = toMoney(ledger.refundAmount);
      const correctionAmount = toMoney(ledger.correctionAmount);

      return {
        date,
        grossCollected,
        refundAmount,
        correctionAmount,
        netCollected: toMoney(grossCollected - refundAmount + correctionAmount),
        transactionCount: ledger.transactionCount,
      };
    });
}

function combineRecentTransactions(
  groups: FinanceTransaction[][],
): FinanceTransaction[] {
  return groups
    .flat()
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, RECENT_TRANSACTION_LIMIT);
}

function createEmptySummary(
  input: FinanceRepositoryInput,
  generatedAt: string,
): FinanceSummary {
  return {
    currency: input.currency,
    timezone: input.timezone,
    availableCurrencies: input.availableCurrencies,
    availableBranches: input.availableBranches,
    summary: {
      orderTaxableAmount: 0,
      orderTaxAmount: 0,
      orderTaxComponents: [],
      grossCollected: 0,
      refundAmount: 0,
      correctionAmount: 0,
      netCollected: 0,
      transactionCount: 0,
      paidOrderCount: 0,
      refundTransactionCount: 0,
      pendingRefundAmount: 0,
      pendingRefundCount: 0,
      outstandingOrderAmount: 0,
      outstandingOrderCount: 0,
    },
    paymentMethods: combinePaymentMethods([[], [], []]),
    dailyTrend: [],
    branchPerformance: [],
    recentTransactions: [],
    filters: {
      from: input.from,
      to: input.to,
      branchId: input.branchId ?? null,
    },
    generatedAt,
  };
}

export async function getTenantFinanceSummaryRecord(
  db: Database,
  input: FinanceRepositoryInput,
): Promise<FinanceSummary> {
  const generatedAt = new Date().toISOString();
  const range = { from: input.from, to: input.to };

  if (
    input.allowedBranchIds !== undefined &&
    input.allowedBranchIds.length === 0
  ) {
    return createEmptySummary(input, generatedAt);
  }

  const [
    methodPayments,
    methodAdjustments,
    methodRefunds,
    paidOrderCount,
    orderTax,
    pendingRefunds,
  ] = await Promise.all([
    findPaymentMethodPayments(db, input, range),
    findPaymentMethodAdjustments(db, input, range),
    findPaymentMethodRefunds(db, input, range),
    findPaidOrderCount(db, input, range),
    findOrderTaxMetrics(db, input, range),
    findPendingRefundMetrics(db, input),
  ]);
  const [
    outstandingOrders,
    branchPayments,
    branchAdjustments,
    branchRefunds,
    dailyPayments,
  ] = await Promise.all([
    findOutstandingOrderMetrics(db, input),
    findBranchPayments(db, input, range),
    findBranchAdjustments(db, input, range),
    findBranchRefunds(db, input, range),
    findDailyPayments(db, input, range),
  ]);
  const [
    dailyAdjustments,
    dailyRefunds,
    recentPayments,
    recentAdjustments,
    recentRefunds,
  ] = await Promise.all([
    findDailyAdjustments(db, input, range),
    findDailyRefunds(db, input, range),
    findRecentPayments(db, input, range),
    findRecentAdjustments(db, input, range),
    findRecentRefunds(db, input, range),
  ]);
  const methodGroups = [methodPayments, methodAdjustments, methodRefunds];
  const paymentMethods = combinePaymentMethods(methodGroups);

  return {
    currency: input.currency,
    timezone: input.timezone,
    availableCurrencies: input.availableCurrencies,
    availableBranches: input.availableBranches,
    summary: {
      ...createSummary(paymentMethods, methodGroups, paidOrderCount, pendingRefunds, outstandingOrders),
      orderTaxableAmount: orderTax.taxableAmount,
      orderTaxAmount: orderTax.taxAmount,
      orderTaxComponents: orderTax.components,
    },
    paymentMethods,
    dailyTrend: combineDailyTrend([
      dailyPayments,
      dailyAdjustments,
      dailyRefunds,
    ]),
    branchPerformance: combineBranchPerformance(input, [
      branchPayments,
      branchAdjustments,
      branchRefunds,
    ]),
    recentTransactions: combineRecentTransactions([
      recentPayments,
      recentAdjustments,
      recentRefunds,
    ]),
    filters: {
      from: input.from,
      to: input.to,
      branchId: input.branchId ?? null,
    },
    generatedAt,
  };
}
