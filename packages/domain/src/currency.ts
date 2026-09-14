/**
 * Currency shape as an accounting rule, not a display detail.
 *
 * `Intl` knows how many decimals a currency shows, but reading it at each call
 * site let two different scales coexist: the API stores money in hundredths
 * (`MONEY_SCALE = 100`) while the receipt asked `Intl` and got 0 for XOF, so a
 * 52.25 order printed as 52. Money rules live here so every layer agrees.
 */

/** Minor units per major unit, e.g. 100 centimes per euro, 1 per franc CFA. */
const CURRENCY_MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

const DEFAULT_MINOR_UNITS = 2;

/**
 * Internal storage scale. Every money column is `numeric(_, 2)` and the pricing
 * engine parses to hundredths, so amounts are always carried at this scale
 * regardless of what the currency can actually be paid in.
 */
export const MONEY_STORAGE_DECIMALS = 2;

/**
 * How many decimals a currency can actually be paid in. XOF has none: there is
 * no sub-franc coin, so 52.25 F CFA is not an amount anyone can hand over.
 */
export function getCurrencyMinorUnits(currency: string | null | undefined): number {
  const code = currency?.trim().toUpperCase();
  if (!code) return DEFAULT_MINOR_UNITS;
  return CURRENCY_MINOR_UNITS[code] ?? DEFAULT_MINOR_UNITS;
}

/**
 * Smallest payable amount, expressed in storage minor units.
 *
 * XOF -> 100 (one franc, since storage is hundredths); EUR -> 1 (one cent).
 */
export function getCurrencyPayableStep(
  currency: string | null | undefined,
): bigint {
  const decimals = getCurrencyMinorUnits(currency);
  const shift = MONEY_STORAGE_DECIMALS - decimals;
  return shift <= 0 ? BigInt(1) : BigInt(10) ** BigInt(shift);
}

/** Half-up rounding to a multiple of `step`, for non-negative amounts. */
export function roundToStep(value: bigint, step: bigint): bigint {
  if (step <= BigInt(1)) return value;
  return ((value + step / BigInt(2)) / step) * step;
}

/**
 * Round an order total to something the customer can actually pay.
 * Half-up: the cent that rounding adds or removes is recorded separately as a
 * rounding adjustment, so the books still balance.
 */
export function roundToPayableAmount(
  value: bigint,
  currency: string | null | undefined,
): bigint {
  return roundToStep(value, getCurrencyPayableStep(currency));
}

/**
 * Cash-only rounding: the smallest note or coin a drawer actually stocks.
 *
 * Distinct from `getCurrencyPayableStep` because electronic payments have no
 * physical constraint — mobile money can take 52 F CFA exactly, while a till
 * with no coin below 5 cannot make that change.
 */
export const DEFAULT_CASH_ROUNDING_STEP_XOF = 5;

/**
 * The cash rounding steps a cashier may choose at checkout, in major units.
 *
 * A fixed allowlist rather than a free amount, and deliberately so: the server
 * computes the concession from this step, so the cashier chooses *how coarse*
 * the rounding is, never *how much* to deduct. An arbitrary amount accepted
 * from the client would be a manual discount wearing a rounding label, which
 * would bypass the reason, permission and idempotency checks that real
 * discounts go through.
 *
 * Matches the branch setting's options so the till and the back office offer
 * the same denominations.
 */
export const CASH_ROUNDING_STEPS = [1, 5, 10, 25, 50, 100] as const;

export type CashRoundingStep = (typeof CASH_ROUNDING_STEPS)[number];

/** True when `step` is one of the offered denominations. */
export function isCashRoundingStep(
  step: number | null | undefined,
): step is CashRoundingStep {
  return (
    typeof step === "number" &&
    (CASH_ROUNDING_STEPS as readonly number[]).includes(step)
  );
}

/**
 * Round a cash amount **down** to the nearest payable note.
 *
 * Down, not half-up: this is a goodwill concession the cashier grants at the
 * counter ("抹零"), so it must never ask the customer for more than the order
 * says. Rounding up would turn a courtesy into a surcharge.
 */
export function roundCashDown(value: bigint, step: bigint): bigint {
  if (step <= BigInt(1) || value <= BigInt(0)) return value;
  return (value / step) * step;
}

/**
 * Cash rounding step in storage minor units, from a per-branch major-unit
 * setting (5 F CFA -> 500 hundredths). A step of 0 or 1 disables rounding.
 */
export function cashRoundingStepToMinor(
  step: number | null | undefined,
): bigint {
  if (!step || step <= 1) return BigInt(1);
  // The setting counts whole notes (5 F CFA, 5 yuan), so it scales by the
  // storage precision, not by how many decimals the currency happens to have.
  const scale = BigInt(10) ** BigInt(MONEY_STORAGE_DECIMALS);
  return BigInt(Math.floor(step)) * scale;
}
