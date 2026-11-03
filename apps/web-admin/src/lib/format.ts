/**
 * Shared formatting helpers.
 *
 * Money formatting lives here so reports, overview, prices, and other modules
 * use one source of truth for currency presentation. Tenant-facing callers
 * should always pass the currency loaded from tenant settings.
 */

const DEFAULT_CURRENCY = "XXX";
const DEFAULT_LOCALE = "en";
const ISO_4217_PATTERN = /^[A-Z]{3}$/;

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(
  locale: string,
  currency: string,
): Intl.NumberFormat {
  const cacheKey = `${locale}|${currency}`;
  const cached = currencyFormatterCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
  });
  currencyFormatterCache.set(cacheKey, formatter);

  return formatter;
}

/**
 * Format a numeric amount as a localized currency string.
 *
 * Locale and currency are intentionally decoupled: a tenant running in the
 * `en` locale with `XOF` currency renders as `XOF 1,234.56` rather than being
 * forced into a `$` presentation. Invalid or empty currency codes fall back to
 * the ISO "no currency" code (`XXX`) so bad data is visible without silently
 * presenting an amount as a real tenant currency.
 */
export function formatMoney(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  const safeCurrency = ISO_4217_PATTERN.test(normalizedCurrency)
    ? normalizedCurrency
    : DEFAULT_CURRENCY;

  return getCurrencyFormatter(locale, safeCurrency).format(value);
}
