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

export function splitMixedPaymentTotal(total: string): {
  cashAmount: string;
  externalAmount: string;
} {
  const parsedTotal = Number(total);
  const totalMinor = Number.isFinite(parsedTotal)
    ? Math.max(0, Math.round(parsedTotal * 100))
    : 0;
  const cashMinor = Math.floor(totalMinor / 2);

  return {
    cashAmount: (cashMinor / 100).toFixed(2),
    externalAmount: ((totalMinor - cashMinor) / 100).toFixed(2),
  };
}
