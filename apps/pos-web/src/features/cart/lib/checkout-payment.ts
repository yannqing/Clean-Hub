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
