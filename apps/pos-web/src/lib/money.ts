export const DEFAULT_POS_CURRENCY = "XOF";

export function normalizeCurrencyCode(
  currency: string | null | undefined,
): string {
  const normalized = currency?.trim().toUpperCase();

  return normalized && /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : DEFAULT_POS_CURRENCY;
}

export function formatPosMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string {
  const value = Number(amount ?? 0);
  const resolvedCurrency = normalizeCurrencyCode(currency);

  if (!Number.isFinite(value)) {
    return `${resolvedCurrency} 0`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: resolvedCurrency,
    currencyDisplay: "code",
    minimumFractionDigits: 0,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
