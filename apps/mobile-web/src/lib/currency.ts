const DEFAULT_CURRENCY = "XOF";

export function resolveTenantCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase();

  return normalized && /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : DEFAULT_CURRENCY;
}

export function formatTenantMoney(
  value: number | string,
  locale: string,
  currency?: string | null,
): string {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: resolveTenantCurrency(currency),
  }).format(numericValue);
}
