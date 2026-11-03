import { getCurrencyPayableStep } from "@cleanhub/domain/currency";

/** Sum of tender amounts, in minor units, tolerant of blank/invalid entries. */
export function sumTenderMinor(
  tenders: readonly { amount: string }[],
): number {
  return tenders.reduce((sum, tender) => {
    const parsed = Number(tender.amount);
    return sum + (Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
  }, 0);
}

/**
 * Whether the tenders still hold exactly what was last seeded for them.
 *
 * The cashier may type a part payment or an over-tender; those edits must
 * survive a total change. Only an untouched set is safe to re-seed, so the
 * comparison is against the total the tenders were seeded from, not the new
 * one.
 */
export function tendersMatchSeededTotal(
  tenders: readonly { amount: string }[],
  seededTotal: string,
): boolean {
  const parsed = Number(seededTotal);
  if (!Number.isFinite(parsed)) return false;
  return sumTenderMinor(tenders) === Math.max(0, Math.round(parsed * 100));
}

/**
 * Split a total into a cash half and an electronic half.
 *
 * The cash leg is snapped **down** to something the drawer can actually take:
 * XOF has no sub-franc coin, so an even split of 25 F CFA into 12.50/12.50
 * produces two amounts nobody can hand over. The remainder goes to the
 * electronic leg, which has no physical denomination to respect -- mobile
 * money settles 13 F CFA exactly.
 *
 * The two legs always sum to the original total, so a currency whose payable
 * step is a single minor unit (EUR, USD) splits exactly as before.
 */
export function splitMixedPaymentTotal(
  total: string,
  currency: string | null | undefined,
): {
  cashAmount: string;
  externalAmount: string;
} {
  const parsedTotal = Number(total);
  const totalMinor = Number.isFinite(parsedTotal)
    ? Math.max(0, Math.round(parsedTotal * 100))
    : 0;
  const step = Number(getCurrencyPayableStep(currency));
  const halfMinor = Math.floor(totalMinor / 2);
  const cashMinor = step > 1 ? Math.floor(halfMinor / step) * step : halfMinor;

  return {
    cashAmount: (cashMinor / 100).toFixed(2),
    externalAmount: ((totalMinor - cashMinor) / 100).toFixed(2),
  };
}
