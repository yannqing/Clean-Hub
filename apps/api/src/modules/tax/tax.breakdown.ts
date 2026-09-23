import { amountToCents, centsToAmount } from "@cleanhub/domain/money";
import { normalizeTaxRate } from "@cleanhub/domain/tax";

export type TaxBreakdownAmount = {
  /** Fraction, e.g. "0.1800". */
  taxRate: string;
  taxableAmount: string;
  taxAmount: string;
};

type TaxedAmounts = {
  taxRateSnapshot: string;
  taxableAmount: string;
  taxAmount: string;
};

/**
 * Taxable base and tax per rate for a stored order, as a receipt, a Z report
 * and a VAT return print them.
 *
 * Read from each line's frozen snapshot, which checkout writes so the lines
 * sum exactly to the order. An order whose lines do not sum to it -- one
 * priced before lines carried their own tax -- is reported as the single rate
 * it was priced at, rather than as a breakdown that disagrees with its total.
 */
export function orderTaxBreakdown(
  order: TaxedAmounts,
  lines: readonly TaxedAmounts[],
): TaxBreakdownAmount[] {
  const legacy = [
    {
      taxRate: normalizeTaxRate(order.taxRateSnapshot),
      taxableAmount: order.taxableAmount,
      taxAmount: order.taxAmount,
    },
  ];
  if (lines.length === 0) return legacy;

  const groups = new Map<string, { taxable: bigint; tax: bigint }>();
  for (const line of lines) {
    const rate = normalizeTaxRate(line.taxRateSnapshot);
    const current = groups.get(rate) ?? { taxable: BigInt(0), tax: BigInt(0) };
    groups.set(rate, {
      taxable: current.taxable + amountToCents(line.taxableAmount),
      tax: current.tax + amountToCents(line.taxAmount),
    });
  }
  const entries = [...groups.entries()];
  const taxableSum = entries.reduce((sum, [, group]) => sum + group.taxable, BigInt(0));
  const taxSum = entries.reduce((sum, [, group]) => sum + group.tax, BigInt(0));
  if (
    taxableSum !== amountToCents(order.taxableAmount) ||
    taxSum !== amountToCents(order.taxAmount)
  ) {
    return legacy;
  }

  const nonEmpty = entries.filter(
    ([, group]) => group.taxable !== BigInt(0) || group.tax !== BigInt(0),
  );
  return (nonEmpty.length > 0 ? nonEmpty : entries.slice(0, 1))
    .sort(([, left], [, right]) =>
      right.taxable === left.taxable ? 0 : right.taxable > left.taxable ? 1 : -1,
    )
    .map(([taxRate, group]) => ({
      taxRate,
      taxableAmount: centsToAmount(group.taxable),
      taxAmount: centsToAmount(group.tax),
    }));
}
