/** Stable identity for a configured tax class, including pre-key templates. */
export function templateTaxRateKey(rate: { key?: string }, index: number): string {
  return rate.key ?? `legacy-${index}`;
}
