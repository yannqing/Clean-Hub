import { and, eq, isNull, sql } from "drizzle-orm";

import {
  orderDiscountAllocations,
  orderDiscountApplications,
  orderItems,
  orders,
  posChannelSettings,
  posTerminalSettings,
  type Database,
} from "@cleanhub/db";

import {
  getCurrencyPayableStep,
  roundCashDown,
} from "@cleanhub/domain/currency";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  allocateProportionally,
  calculateTaxedTotals,
  normalizeTaxRate,
  taxRateToScale,
  type TaxLineAllocation,
} from "@cleanhub/domain/tax";
import {
  effectiveLineTaxRate,
  resolveCatalogTaxRates,
} from "../../tax/tax.rates.js";
import { minorToMoney, moneyToMinor } from "../discounts/pricing-engine.js";

export type PosFinancialRules = {
  roundingRule: "none" | "round_yuan" | "round_jiao";
  taxEnabled: boolean;
  taxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  taxLabel?: string | null;
  taxComponents?: Array<{ name: string; rate: string }> | null;
  /**
   * Settlement currency. Totals must land on an amount the customer can
   * actually pay: XOF has no sub-franc coin, so a 52.25 total is not a real
   * price. Optional so callers that predate this default to the storage scale.
   */
  currency?: string | null;
};

export type PosTaxBreakdownEntry = {
  taxRate: string;
  taxableMinor: bigint;
  taxMinor: bigint;
};

export type PosTaxComponentEntry = {
  name: string;
  rate: string;
  parentRate: string;
  taxableMinor: bigint;
  taxMinor: bigint;
};

export type PosFinancialTotals = {
  taxableMinor: bigint;
  taxMinor: bigint;
  /**
   * The dominant rate -- the group with the largest base -- so a single-rate
   * order reads exactly as before. A mixed order's full picture is in
   * `taxBreakdown`, which is what receipts and tax reports print.
   */
  taxRate: string;
  taxBreakdown: PosTaxBreakdownEntry[];
  taxComponents: PosTaxComponentEntry[];
  /** Per-line allocation, in the order of the lines passed in. */
  lineTaxes: TaxLineAllocation[];
  pricesIncludeTax: boolean;
  taxExemptionReason: string | null;
  taxRegistrationNumber: string | null;
  taxLabel: string | null;
  roundingAdjustmentMinor: bigint;
  totalMinor: bigint;
};

export type PosFinancialLine = {
  key: string;
  grossMinor: bigint;
  /** The line's own rate; null or absent means the tenant default. */
  taxRate?: string | null;
  /** Discount already attributed to this line by the discount engine. */
  discountMinor?: bigint;
};

/**
 * Apply the cashier's cash concession to an already-priced total.
 *
 * Rounds **down** to the till's smallest note and folds the difference into
 * the order's rounding adjustment, so the books still add up: the customer
 * pays a payable amount and the shortfall is named rather than lost.
 */
export function applyCashRoundingToTotals(
  totals: PosFinancialTotals,
  stepMinor: bigint,
): PosFinancialTotals {
  const rounded = roundCashDown(totals.totalMinor, stepMinor);
  if (rounded === totals.totalMinor) return totals;
  return {
    ...totals,
    totalMinor: rounded,
    roundingAdjustmentMinor:
      totals.roundingAdjustmentMinor + (rounded - totals.totalMinor),
  };
}

function signedMinorToMoney(value: bigint): string {
  return value < BigInt(0) ? `-${minorToMoney(-value)}` : minorToMoney(value);
}

function roundToIncrement(value: bigint, increment: bigint): bigint {
  if (increment <= BigInt(1)) return value;
  return ((value + increment / BigInt(2)) / increment) * increment;
}

/**
 * Price an order: tax per rate group, then round to what can be paid.
 *
 * `lines` carries each line's own rate. Without it the whole subtotal is one
 * line at the tenant default, which is exactly the single-rate calculation
 * this replaced -- callers that do not itemise keep their results unchanged.
 */
export function calculatePosFinancialTotals(input: {
  subtotalMinor: bigint;
  discountMinor: bigint;
  rules: PosFinancialRules;
  taxExemptionReason?: string | null;
  lines?: PosFinancialLine[];
}): PosFinancialTotals {
  const exemption = input.taxExemptionReason?.trim() || null;
  const lines =
    input.lines && input.lines.length > 0
      ? input.lines
      : [{ key: "order", grossMinor: input.subtotalMinor }];
  const taxed = calculateTaxedTotals({
    lines: lines.map((line) => ({
      key: line.key,
      grossMinor: line.grossMinor,
      taxRate: line.taxRate ?? input.rules.taxRate,
      discountMinor: line.discountMinor,
    })),
    discountMinor: input.discountMinor,
    taxEnabled: input.rules.taxEnabled,
    pricesIncludeTax: input.rules.pricesIncludeTax,
    exemption,
  });
  const beforeRounding = input.rules.pricesIncludeTax
    ? taxed.baseMinor
    : taxed.baseMinor + taxed.taxMinor;
  // A currency's smallest payable unit is a hard floor, not a preference: the
  // configured rule may round more coarsely than the currency, never finer.
  const currencyStep = getCurrencyPayableStep(input.rules.currency);
  const configuredStep =
    input.rules.roundingRule === "round_yuan"
      ? BigInt(100)
      : input.rules.roundingRule === "round_jiao"
        ? BigInt(10)
        : BigInt(1);
  const step = configuredStep > currencyStep ? configuredStep : currencyStep;
  const rounded = roundToIncrement(beforeRounding, step);
  const taxBreakdown = taxed.groups
    .filter((group) => group.baseMinor !== BigInt(0) || taxed.groups.length === 1)
    .map((group) => ({
      taxRate: group.taxRate,
      taxableMinor: group.taxableMinor,
      taxMinor: group.taxMinor,
    }));
  const componentGroup = taxed.groups.find(
    (group) =>
      group.taxRate === normalizeTaxRate(input.rules.taxRate) &&
      group.taxMinor > BigInt(0),
  );
  const candidates = input.rules.taxComponents ?? [];
  const configuredComponents = candidates.reduce(
    (sum, component) => sum + taxRateToScale(component.rate),
    BigInt(0),
  ) === taxRateToScale(input.rules.taxRate) ? candidates : [];
  const componentAmounts = componentGroup && configuredComponents.length > 0
    ? allocateProportionally(
        componentGroup.taxMinor,
        configuredComponents.map((component) => taxRateToScale(component.rate)),
      )
    : [];
  const taxComponents: PosTaxComponentEntry[] = componentGroup
    ? configuredComponents.map((component, index) => ({
        name: component.name,
        rate: normalizeTaxRate(component.rate),
        parentRate: componentGroup.taxRate,
        taxableMinor: componentGroup.taxableMinor,
        taxMinor: componentAmounts[index] ?? BigInt(0),
      }))
    : [];
  return {
    taxableMinor: taxed.taxableMinor,
    taxMinor: taxed.taxMinor,
    taxRate: taxed.groups[0]?.taxRate ?? "0.0000",
    taxBreakdown,
    taxComponents,
    lineTaxes: taxed.lines,
    pricesIncludeTax: input.rules.pricesIncludeTax,
    taxExemptionReason: exemption,
    taxRegistrationNumber: input.rules.taxRegistrationNumber,
    taxLabel: input.rules.taxLabel ?? null,
    roundingAdjustmentMinor: rounded - beforeRounding,
    totalMinor: rounded,
  };
}

export async function resolvePosFinancialRules(
  db: Database,
  authContext: AuthContext,
  tenantId: string,
  currency?: string | null,
): Promise<PosFinancialRules> {
  const channelRows = await db
    .select({
      roundingRule: posChannelSettings.defaultRoundingRule,
      taxEnabled: posChannelSettings.taxEnabled,
      taxRate: posChannelSettings.defaultTaxRate,
      pricesIncludeTax: posChannelSettings.pricesIncludeTax,
      taxRegistrationNumber: posChannelSettings.taxRegistrationNumber,
      taxLabel: posChannelSettings.taxLabel,
      taxComponents: posChannelSettings.defaultTaxComponents,
    })
    .from(posChannelSettings)
    .where(eq(posChannelSettings.tenantId, tenantId))
    .limit(1);
  const channel = {
    ...(channelRows[0] ?? {
      roundingRule: "none" as const,
      taxEnabled: false,
      taxRate: "0.0000",
      pricesIncludeTax: true,
      taxRegistrationNumber: null,
      taxLabel: null,
      taxComponents: null,
    }),
    currency: currency ?? null,
  };
  if (!authContext.terminalId) return channel;
  const terminalRows = await db
    .select({ roundingRule: posTerminalSettings.roundingRule })
    .from(posTerminalSettings)
    .where(
      and(
        eq(posTerminalSettings.id, authContext.terminalId),
        eq(posTerminalSettings.tenantId, tenantId),
        eq(posTerminalSettings.status, "active"),
      ),
    )
    .limit(1);
  return {
    ...channel,
    roundingRule: terminalRows[0]?.roundingRule ?? channel.roundingRule,
  };
}

export async function applyPosOrderFinancialRules(
  db: Database,
  input: {
    authContext: AuthContext;
    tenantId: string;
    orderId: string;
    taxExemptionReason?: string | null;
    actorUserId: string;
    /**
     * Extra rounding the cashier conceded at the counter, in storage minor
     * units. Applied on top of the currency's own step, and always downward:
     * it is a goodwill concession, never a surcharge.
     */
    cashRoundingStepMinor?: bigint;
  },
): Promise<PosFinancialTotals> {
  const orderRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("Order was not found for financial rules.");
  const rules = await resolvePosFinancialRules(
    db,
    input.authContext,
    input.tenantId,
    order.currency,
  );
  const itemRows = await db
    .select({
      id: orderItems.id,
      lineAmount: orderItems.lineAmount,
      serviceId: orderItems.serviceId,
      productSkuId: orderItems.productSkuId,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        isNull(orderItems.deletedAt),
      ),
    )
    .orderBy(orderItems.createdAt, orderItems.id);

  // Each line is taxed at its own service's or product's rate. The discount
  // engine's per-line attribution is honoured, so a code on one exempt item
  // cannot lower the tax on a standard-rated one.
  const [catalogRates, discountRows] = await Promise.all([
    resolveCatalogTaxRates(db, {
      tenantId: input.tenantId,
      serviceIds: itemRows.map((item) => item.serviceId),
      productSkuIds: itemRows.map((item) => item.productSkuId),
    }),
    db
      .select({
        orderItemId: orderDiscountAllocations.orderItemId,
        amount: sql<string>`coalesce(sum(${orderDiscountAllocations.amount}), 0)::text`,
      })
      .from(orderDiscountAllocations)
      .innerJoin(
        orderDiscountApplications,
        and(
          eq(orderDiscountApplications.tenantId, orderDiscountAllocations.tenantId),
          eq(orderDiscountApplications.id, orderDiscountAllocations.applicationId),
        ),
      )
      .where(
        and(
          eq(orderDiscountAllocations.tenantId, input.tenantId),
          eq(orderDiscountAllocations.orderId, input.orderId),
          eq(orderDiscountApplications.status, "applied"),
        ),
      )
      .groupBy(orderDiscountAllocations.orderItemId),
  ]);
  const discountByItem = new Map(
    discountRows
      .filter((row) => row.orderItemId)
      .map((row) => [row.orderItemId as string, moneyToMinor(row.amount)]),
  );
  const lines: PosFinancialLine[] = itemRows.map((item) => ({
    key: item.id,
    grossMinor: moneyToMinor(item.lineAmount),
    taxRate: effectiveLineTaxRate(catalogRates, item, rules.taxRate),
    discountMinor: discountByItem.get(item.id),
  }));
  // The order subtotal is the authority on what is being charged. Any part of
  // it the lines do not account for is taxed at the default rather than lost.
  const subtotalMinor = moneyToMinor(order.subtotalAmount);
  const itemisedMinor = lines.reduce((sum, line) => sum + line.grossMinor, BigInt(0));
  if (subtotalMinor > itemisedMinor) {
    lines.push({ key: "unitemised", grossMinor: subtotalMinor - itemisedMinor });
  }

  const pricedTotals = calculatePosFinancialTotals({
    subtotalMinor,
    discountMinor: moneyToMinor(order.discountAmount),
    rules,
    taxExemptionReason: input.taxExemptionReason,
    lines,
  });
  const totals =
    input.cashRoundingStepMinor && input.cashRoundingStepMinor > BigInt(1)
      ? applyCashRoundingToTotals(pricedTotals, input.cashRoundingStepMinor)
      : pricedTotals;
  const allocationByItem = new Map(
    totals.lineTaxes.map((line) => [line.key, line]),
  );
  for (const item of itemRows) {
    const allocation = allocationByItem.get(item.id);
    await db
      .update(orderItems)
      .set({
        taxableAmount: minorToMoney(allocation?.taxableMinor ?? BigInt(0)),
        taxAmount: minorToMoney(allocation?.taxMinor ?? BigInt(0)),
        // The rate this line was actually taxed at, so reports can file tax
        // by rate from the lines alone, whatever the catalogue says later.
        taxRateSnapshot: allocation?.taxRate ?? "0.0000",
        taxExemptionReason: totals.taxExemptionReason,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${orderItems.version} + 1`,
      })
      .where(
        and(
          eq(orderItems.id, item.id),
          eq(orderItems.tenantId, input.tenantId),
        ),
      );
  }
  await db
    .update(orders)
    .set({
      taxableAmount: minorToMoney(totals.taxableMinor),
      taxAmount: minorToMoney(totals.taxMinor),
      taxRateSnapshot: totals.taxRate,
      pricesIncludeTax: totals.pricesIncludeTax,
      taxExemptionReason: totals.taxExemptionReason,
      taxRegistrationNumberSnapshot: totals.taxRegistrationNumber,
      taxLabelSnapshot: totals.taxLabel,
      taxComponentsSnapshot: totals.taxComponents.map((entry) => ({
        name: entry.name,
        rate: entry.rate,
        parentRate: entry.parentRate,
        taxableAmount: minorToMoney(entry.taxableMinor),
        taxAmount: minorToMoney(entry.taxMinor),
      })),
      roundingAdjustmentAmount: signedMinorToMoney(
        totals.roundingAdjustmentMinor,
      ),
      totalAmount: minorToMoney(totals.totalMinor),
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${orders.version} + 1`,
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, input.tenantId),
        isNull(orders.deletedAt),
      ),
    );
  return totals;
}

export function financialTotalsToMoney(totals: PosFinancialTotals) {
  return {
    taxableAmount: minorToMoney(totals.taxableMinor),
    taxAmount: minorToMoney(totals.taxMinor),
    taxRate: totals.taxRate,
    taxBreakdown: totals.taxBreakdown.map((entry) => ({
      taxRate: entry.taxRate,
      taxableAmount: minorToMoney(entry.taxableMinor),
      taxAmount: minorToMoney(entry.taxMinor),
    })),
    taxComponents: totals.taxComponents.map((entry) => ({
      name: entry.name,
      rate: entry.rate,
      parentRate: entry.parentRate,
      taxableAmount: minorToMoney(entry.taxableMinor),
      taxAmount: minorToMoney(entry.taxMinor),
    })),
    taxLabel: totals.taxLabel,
    pricesIncludeTax: totals.pricesIncludeTax,
    taxExemptionReason: totals.taxExemptionReason,
    taxRegistrationNumber: totals.taxRegistrationNumber,
    roundingAdjustmentAmount: signedMinorToMoney(
      totals.roundingAdjustmentMinor,
    ),
    totalAmount: minorToMoney(totals.totalMinor),
  };
}
