import type { PosRoundingRule } from "@cleanhub/api-client";
import { getCurrencyPayableStep, roundToStep } from "@cleanhub/domain/currency";
import { amountToCents, centsToAmount } from "@cleanhub/domain/money";
import { allocateProportionally, calculateTaxedTotals, normalizeTaxRate, taxRateToScale } from "@cleanhub/domain/tax";

import type { PosCartSnapshot } from "../cart.types";

export type LocalPricingRules = {
  currency: string;
  taxEnabled: boolean;
  /** Fraction, e.g. "0.1800"; applies to lines without a rate of their own. */
  defaultTaxRate: string;
  taxLabel?: string | null;
  taxComponents?: Array<{ name: string; rate: string }> | null;
  pricesIncludeTax: boolean;
  roundingRule: PosRoundingRule;
};

export type LocalTaxBreakdownEntry = {
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
};

export type LocalCartPricing = {
  subtotalAmount: string;
  taxAmount: string;
  taxBreakdown: LocalTaxBreakdownEntry[];
  taxLabel: string | null;
  taxComponents: Array<{ name: string; rate: string; parentRate: string; taxableAmount: string; taxAmount: string }>;
  roundingAdjustmentAmount: string;
  totalAmount: string;
};

function signedCentsToAmount(value: bigint): string {
  return value < BigInt(0) ? `-${centsToAmount(-value)}` : centsToAmount(value);
}

/**
 * Price a cart on the till, the way the server's
 * `calculatePosFinancialTotals` prices the order it becomes.
 *
 * Used when the till cannot ask the server, i.e. an offline sale. The replay
 * sends this total as the expected amount and the server rejects the sale if
 * its own calculation differs, so this must agree to the unit: each line is
 * taxed at its own rate (or the default), tax is taken once per rate, then the
 * total is rounded to the currency's payable step or the configured rule,
 * whichever is coarser. Offline sales carry no discount code.
 */
export function calculateLocalCartPricing(
  cart: PosCartSnapshot,
  rules: LocalPricingRules,
): LocalCartPricing {
  const lines = cart.lines.map((line) => ({
    key: line.id,
    grossMinor:
      line.kind === "product"
        ? amountToCents(line.unitAmount) * BigInt(line.quantity)
        : amountToCents(line.lineAmount),
    // Ticket lines cannot be sold offline, so their service's own rate never
    // decides an offline total; the preview prices them while online.
    taxRate:
      (line.kind === "product" ? line.taxRate : null) ?? rules.defaultTaxRate,
  }));
  const subtotalMinor = lines.reduce((sum, line) => sum + line.grossMinor, BigInt(0));
  const taxed = calculateTaxedTotals({
    lines,
    discountMinor: BigInt(0),
    taxEnabled: rules.taxEnabled,
    pricesIncludeTax: rules.pricesIncludeTax,
    exemption: null,
  });
  const beforeRounding = rules.pricesIncludeTax
    ? taxed.baseMinor
    : taxed.baseMinor + taxed.taxMinor;
  const configuredStep =
    rules.roundingRule === "round_yuan"
      ? BigInt(100)
      : rules.roundingRule === "round_jiao"
        ? BigInt(10)
        : BigInt(1);
  const currencyStep = getCurrencyPayableStep(rules.currency);
  const step = configuredStep > currencyStep ? configuredStep : currencyStep;
  const totalMinor = roundToStep(beforeRounding, step);
  const componentGroup = taxed.groups.find((group) =>
    group.taxRate === normalizeTaxRate(rules.defaultTaxRate) && group.taxMinor > BigInt(0));
  const candidates = rules.taxComponents ?? [];
  const configured = candidates.reduce((sum, component) => sum + taxRateToScale(component.rate), BigInt(0)) === taxRateToScale(rules.defaultTaxRate)
    ? candidates : [];
  const componentAmounts = componentGroup && configured.length > 0
    ? allocateProportionally(componentGroup.taxMinor, configured.map((component) => taxRateToScale(component.rate))) : [];

  return {
    subtotalAmount: centsToAmount(subtotalMinor),
    taxAmount: centsToAmount(taxed.taxMinor),
    taxBreakdown: taxed.groups
      .filter((group) => group.baseMinor !== BigInt(0) || taxed.groups.length === 1)
      .map((group) => ({
        taxRate: group.taxRate,
        taxableAmount: centsToAmount(group.taxableMinor),
        taxAmount: centsToAmount(group.taxMinor),
      })),
    taxLabel: rules.taxLabel ?? null,
    taxComponents: componentGroup ? configured.map((component, index) => ({
      name: component.name,
      rate: normalizeTaxRate(component.rate),
      parentRate: componentGroup.taxRate,
      taxableAmount: centsToAmount(componentGroup.taxableMinor),
      taxAmount: centsToAmount(componentAmounts[index] ?? BigInt(0)),
    })) : [],
    roundingAdjustmentAmount: signedCentsToAmount(totalMinor - beforeRounding),
    totalAmount: centsToAmount(totalMinor),
  };
}
