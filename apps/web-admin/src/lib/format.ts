/**
 * Shared formatting helpers.
 *
 * Money formatting lives here so reports, overview, prices, and other modules
 * use one source of truth for currency presentation. CleanHub's default market
 * is West Africa, so the platform default currency is `XOF` (West African CFA
 * franc) rather than USD.
 */

const DEFAULT_CURRENCY = "XOF";
const DEFAULT_LOCALE = "en";
const ISO_4217_PATTERN = /^[A-Z]{3}$/;

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(locale: string, currency: string): Intl.NumberFormat {
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
 * the platform default (`XOF`) so the UI never throws on bad data.
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
