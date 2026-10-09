/**
 * Tax rates are stored as fractions ("0.1800" is 18%) and edited as percents.
 *
 * Done on strings, not floats: 7.35 / 100 in floating point is
 * 0.07350000000000001, which the API rightly rejects as more than four
 * decimals. Shifting the decimal point two places is exact.
 */
const PERCENT_PATTERN = /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/;

/** "18" -> "0.1800"; "7.5" -> "0.0750"; null when not 0..100 with <= 2 decimals. */
export function percentToFraction(percent: string): string | null {
  const trimmed = percent.trim();
  if (!PERCENT_PATTERN.test(trimmed)) return null;
  const [whole = "0", decimals = ""] = trimmed.split(".");
  const hundredths = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  const units = Math.floor(hundredths / 10_000);
  const fraction = String(hundredths % 10_000).padStart(4, "0");
  return `${units}.${fraction}`;
}

/** "0.1800" -> "18"; "0.0750" -> "7.5". */
export function fractionToPercent(fraction: string): string {
  const hundredths = Math.round(Number(fraction) * 10_000);
  if (!Number.isFinite(hundredths)) return "0";
  const whole = Math.floor(hundredths / 100);
  const decimals = String(hundredths % 100).padStart(2, "0").replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : String(whole);
}

/** "0.1800" -> "18%", for labels. */
export function formatTaxRatePercent(fraction: string): string {
  return `${fractionToPercent(fraction)}%`;
}
