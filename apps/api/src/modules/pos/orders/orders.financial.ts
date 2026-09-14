import { and, eq, isNull, sql } from "drizzle-orm";

import {
  orderItems,
  orders,
  posChannelSettings,
  posTerminalSettings,
  type Database,
} from "@cleanhub/db";

import { getCurrencyPayableStep } from "@cleanhub/domain/currency";

import type { AuthContext } from "../../auth/auth.types.js";
import { minorToMoney, moneyToMinor } from "../discounts/pricing-engine.js";

export type PosFinancialRules = {
  roundingRule: "none" | "round_yuan" | "round_jiao";
  taxEnabled: boolean;
  taxRate: string;
  pricesIncludeTax: boolean;
  taxRegistrationNumber: string | null;
  /**
   * Settlement currency. Totals must land on an amount the customer can
   * actually pay: XOF has no sub-franc coin, so a 52.25 total is not a real
   * price. Optional so callers that predate this default to the storage scale.
   */
  currency?: string | null;
};

export type PosFinancialTotals = {
  taxableMinor: bigint;
  taxMinor: bigint;
  taxRate: string;
  pricesIncludeTax: boolean;
  taxExemptionReason: string | null;
  taxRegistrationNumber: string | null;
  roundingAdjustmentMinor: bigint;
  totalMinor: bigint;
};

function signedMinorToMoney(value: bigint): string {
  return value < BigInt(0) ? `-${minorToMoney(-value)}` : minorToMoney(value);
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) return BigInt(0);
  return (numerator + denominator / BigInt(2)) / denominator;
}

function roundToIncrement(value: bigint, increment: bigint): bigint {
  if (increment <= BigInt(1)) return value;
  return ((value + increment / BigInt(2)) / increment) * increment;
}

function taxRateToScale(value: string): bigint {
  const scaled = Math.round(Number(value) * 10_000);
  return BigInt(Number.isFinite(scaled) ? Math.max(0, scaled) : 0);
}

export function calculatePosFinancialTotals(input: {
  subtotalMinor: bigint;
  discountMinor: bigint;
  rules: PosFinancialRules;
  taxExemptionReason?: string | null;
}): PosFinancialTotals {
  const discount =
    input.discountMinor > input.subtotalMinor
      ? input.subtotalMinor
      : input.discountMinor;
  const baseMinor = input.subtotalMinor - discount;
  const exemption = input.taxExemptionReason?.trim() || null;
  const rateScaled =
    input.rules.taxEnabled && !exemption
      ? taxRateToScale(input.rules.taxRate)
      : BigInt(0);
  const percentDenominator = BigInt(100 * 10_000);
  const taxMinor =
    rateScaled === BigInt(0)
      ? BigInt(0)
      : input.rules.pricesIncludeTax
        ? roundRatio(baseMinor * rateScaled, percentDenominator + rateScaled)
        : roundRatio(baseMinor * rateScaled, percentDenominator);
  const taxableMinor = input.rules.pricesIncludeTax
    ? baseMinor - taxMinor
    : baseMinor;
  const beforeRounding = input.rules.pricesIncludeTax
    ? baseMinor
    : baseMinor + taxMinor;
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
  return {
    taxableMinor,
    taxMinor,
    taxRate: rateScaled === BigInt(0) ? "0.0000" : input.rules.taxRate,
    pricesIncludeTax: input.rules.pricesIncludeTax,
    taxExemptionReason: exemption,
    taxRegistrationNumber: input.rules.taxRegistrationNumber,
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
  const totals = calculatePosFinancialTotals({
    subtotalMinor: moneyToMinor(order.subtotalAmount),
    discountMinor: moneyToMinor(order.discountAmount),
    rules,
    taxExemptionReason: input.taxExemptionReason,
  });
  const itemRows = await db
    .select({ id: orderItems.id, lineAmount: orderItems.lineAmount })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        isNull(orderItems.deletedAt),
      ),
    )
    .orderBy(orderItems.createdAt, orderItems.id);
  const grossTotal = itemRows.reduce(
    (sum, item) => sum + moneyToMinor(item.lineAmount),
    BigInt(0),
  );
  let allocatedTaxable = BigInt(0);
  let allocatedTax = BigInt(0);
  for (const [index, item] of itemRows.entries()) {
    const last = index === itemRows.length - 1;
    const gross = moneyToMinor(item.lineAmount);
    const taxable = last
      ? totals.taxableMinor - allocatedTaxable
      : grossTotal === BigInt(0)
        ? BigInt(0)
        : roundRatio(totals.taxableMinor * gross, grossTotal);
    const tax = last
      ? totals.taxMinor - allocatedTax
      : grossTotal === BigInt(0)
        ? BigInt(0)
        : roundRatio(totals.taxMinor * gross, grossTotal);
    allocatedTaxable += taxable;
    allocatedTax += tax;
    await db
      .update(orderItems)
      .set({
        taxableAmount: minorToMoney(taxable),
        taxAmount: minorToMoney(tax),
        taxRateSnapshot: totals.taxRate,
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
    pricesIncludeTax: totals.pricesIncludeTax,
    taxExemptionReason: totals.taxExemptionReason,
    taxRegistrationNumber: totals.taxRegistrationNumber,
    roundingAdjustmentAmount: signedMinorToMoney(
      totals.roundingAdjustmentMinor,
    ),
    totalAmount: minorToMoney(totals.totalMinor),
  };
}
