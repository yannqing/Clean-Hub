/**
 * Per-rate tax for a basket whose lines may carry different rates.
 *
 * Shared by the API and pos-web so the server total and an offline till's
 * total agree to the franc; the offline replay rejects a sale whose expected
 * total differs. The Android till transcribes this in Kotlin
 * (`calculateNativeLocalPricing`), pinned by NativeOfflinePricingParityTest.
 *
 * Tax is computed once per rate group, not once per line. That is how a VAT
 * return is filed -- taxable base and tax per rate -- and it keeps rounding to
 * one step per group: rounding every line separately drifts by a franc per
 * line, and a ten-line receipt would then disagree with its own total.
 *
 * With a single rate this reduces exactly to the order-level formula it
 * replaces: one group whose base is subtotal minus discount.
 *
 * All rates are fractions ("0.1800" is 18%). All amounts are storage minor
 * units (hundredths) as bigint.
 */

/** Ten-thousandths of the fraction, matching the columns' four decimals. */
export const TAX_RATE_SCALE = BigInt(10_000);

const ZERO = BigInt(0);

export type TaxLineInput = {
  /** Stable identity for the line, returned with its allocation. */
  key: string;
  grossMinor: bigint;
  /** This line's rate as a fraction; ignored when tax is off or exempted. */
  taxRate: string;
  /**
   * The part of the order discount the discount engine already attributed to
   * this line. A code that targets one product must reduce that product's
   * taxable base, not everyone's: spread evenly, a discount on an exempt item
   * would wrongly lower the tax on a standard-rated one.
   */
  discountMinor?: bigint;
};

export type TaxGroup = {
  taxRate: string;
  baseMinor: bigint;
  taxableMinor: bigint;
  taxMinor: bigint;
};

export type TaxLineAllocation = {
  key: string;
  taxRate: string;
  discountMinor: bigint;
  taxableMinor: bigint;
  taxMinor: bigint;
};

export type TaxedTotals = {
  /** Gross after discount: what the lines are worth before rounding. */
  baseMinor: bigint;
  taxableMinor: bigint;
  taxMinor: bigint;
  /** Ordered by descending base: the first entry is the dominant rate. */
  groups: TaxGroup[];
  lines: TaxLineAllocation[];
};

export function taxRateToScale(value: string): bigint {
  const scaled = Math.round(Number(value) * 10_000);
  return BigInt(Number.isFinite(scaled) ? Math.max(0, scaled) : 0);
}

/** Canonical four-decimal form, so "0.18" and "0.1800" group together. */
export function normalizeTaxRate(value: string): string {
  const scaled = taxRateToScale(value);
  const whole = scaled / TAX_RATE_SCALE;
  const fraction = (scaled % TAX_RATE_SCALE).toString().padStart(4, "0");
  return `${whole}.${fraction}`;
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= ZERO) return ZERO;
  return (numerator + denominator / BigInt(2)) / denominator;
}

/**
 * Split `total` across `weights` so the parts sum to exactly `total`.
 *
 * Largest-remainder: each part is floored, then the leftover units go to the
 * parts that lost the most. Ties go to the earlier index so the result is
 * deterministic -- the server, pos-web and the Android till must agree to the
 * franc on the same basket.
 */
export function allocateProportionally(total: bigint, weights: bigint[]): bigint[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, ZERO);
  if (weights.length === 0) return [];
  if (weightSum <= ZERO) {
    // Nothing to weigh by: the whole amount lands on the first part.
    return weights.map((_, index) => (index === 0 ? total : ZERO));
  }
  const floors = weights.map((weight) => (total * weight) / weightSum);
  const remainders = weights.map(
    (weight, index) => total * weight - floors[index]! * weightSum,
  );
  let leftover = total - floors.reduce((sum, part) => sum + part, ZERO);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((left, right) =>
      right.remainder === left.remainder
        ? left.index - right.index
        : right.remainder > left.remainder
          ? 1
          : -1,
    );
  const parts = [...floors];
  for (const { index } of order) {
    if (leftover <= ZERO) break;
    parts[index] = parts[index]! + BigInt(1);
    leftover -= BigInt(1);
  }
  return parts;
}

export function calculateTaxedTotals(input: {
  lines: TaxLineInput[];
  discountMinor: bigint;
  taxEnabled: boolean;
  pricesIncludeTax: boolean;
  exemption: string | null;
}): TaxedTotals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.grossMinor, ZERO);
  const discount = input.discountMinor > subtotal ? subtotal : input.discountMinor;
  // Discounts the engine attributed to specific lines stay on those lines;
  // only what it could not attribute is spread in proportion to what is left.
  const attributed = input.lines.map((line) => {
    const own = line.discountMinor ?? ZERO;
    if (own <= ZERO) return ZERO;
    return own > line.grossMinor ? line.grossMinor : own;
  });
  const attributedTotal = attributed.reduce((sum, part) => sum + part, ZERO);
  const cappedAttributed =
    attributedTotal > discount
      ? allocateProportionally(discount, attributed)
      : attributed;
  const residual =
    discount - cappedAttributed.reduce((sum, part) => sum + part, ZERO);
  const residualParts = allocateProportionally(
    residual,
    input.lines.map((line, index) => line.grossMinor - (cappedAttributed[index] ?? ZERO)),
  );
  const lineDiscounts = input.lines.map(
    (_, index) => (cappedAttributed[index] ?? ZERO) + (residualParts[index] ?? ZERO),
  );
  const applyTax = input.taxEnabled && !input.exemption;

  const lines = input.lines.map((line, index) => {
    const lineDiscount = lineDiscounts[index] ?? ZERO;
    return {
      key: line.key,
      baseMinor: line.grossMinor - lineDiscount,
      discountMinor: lineDiscount,
      taxRate: applyTax ? normalizeTaxRate(line.taxRate) : "0.0000",
    };
  });

  // Group in first-seen order, then compute each group's tax exactly once.
  const groupOrder: string[] = [];
  const groupBase = new Map<string, bigint>();
  for (const line of lines) {
    if (!groupBase.has(line.taxRate)) groupOrder.push(line.taxRate);
    groupBase.set(line.taxRate, (groupBase.get(line.taxRate) ?? ZERO) + line.baseMinor);
  }

  const groups: TaxGroup[] = groupOrder.map((taxRate) => {
    const baseMinor = groupBase.get(taxRate) ?? ZERO;
    const scaled = taxRateToScale(taxRate);
    const taxMinor =
      scaled === ZERO
        ? ZERO
        : input.pricesIncludeTax
          ? roundRatio(baseMinor * scaled, TAX_RATE_SCALE + scaled)
          : roundRatio(baseMinor * scaled, TAX_RATE_SCALE);
    return {
      taxRate,
      baseMinor,
      taxableMinor: input.pricesIncludeTax ? baseMinor - taxMinor : baseMinor,
      taxMinor,
    };
  });

  // Hand each group's tax and taxable base back to its lines, so the order
  // lines always sum to the group and the groups to the order.
  const allocations = new Map<string, { taxableMinor: bigint; taxMinor: bigint }>();
  for (const group of groups) {
    const members = lines.filter((line) => line.taxRate === group.taxRate);
    const weights = members.map((line) => line.baseMinor);
    const taxParts = allocateProportionally(group.taxMinor, weights);
    const taxableParts = allocateProportionally(group.taxableMinor, weights);
    members.forEach((line, index) => {
      allocations.set(line.key, {
        taxMinor: taxParts[index] ?? ZERO,
        taxableMinor: taxableParts[index] ?? ZERO,
      });
    });
  }

  const sortedGroups = [...groups].sort((left, right) =>
    right.baseMinor === left.baseMinor ? 0 : right.baseMinor > left.baseMinor ? 1 : -1,
  );

  return {
    baseMinor: subtotal - discount,
    taxableMinor: groups.reduce((sum, group) => sum + group.taxableMinor, ZERO),
    taxMinor: groups.reduce((sum, group) => sum + group.taxMinor, ZERO),
    groups: sortedGroups,
    lines: lines.map((line) => ({
      key: line.key,
      taxRate: line.taxRate,
      discountMinor: line.discountMinor,
      taxableMinor: allocations.get(line.key)?.taxableMinor ?? ZERO,
      taxMinor: allocations.get(line.key)?.taxMinor ?? ZERO,
    })),
  };
}

/**
 * "0.1800" -> "18%", "0.0750" -> "7.5%", for receipts and totals.
 *
 * Exact: `Number("0.07") * 100` is 7.000000000000001, which is how a receipt
 * came to read "VAT 7.000000000000001%".
 */
export function formatTaxRatePercent(value: string): string {
  const scaled = taxRateToScale(value);
  const whole = scaled / BigInt(100);
  const hundredths = (scaled % BigInt(100)).toString().padStart(2, "0").replace(/0+$/, "");
  return hundredths ? `${whole}.${hundredths}%` : `${whole}%`;
}
