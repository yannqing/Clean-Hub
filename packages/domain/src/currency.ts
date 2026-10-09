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

/**
 * Convert a stored money string into the minor units a printed receipt uses.
 *
 * Receipts carry amounts in the *currency's* minor units, not the storage
 * scale: `packages/hardware` divides by the same currency scale to format, so
 * an XOF receipt prints 1000 as "1,000 F CFA" rather than "10.00". Reading
 * that scale from `Intl` at each call site is what printed a 52.25 order as
 * 52, so the scale comes from the currency table here instead.
 */
export function moneyToReceiptMinor(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;

  const decimals = getCurrencyMinorUnits(currency);
  // Money arrives as a `numeric(_, 2)` string, so hundredths are the exact
  // representation to round from.
  const storageMinor = Math.round(parsed * 10 ** MONEY_STORAGE_DECIMALS);
  const shift = MONEY_STORAGE_DECIMALS - decimals;
  if (shift <= 0) return storageMinor;

  return Math.round(storageMinor / 10 ** shift);
}

/**
 * Split an already-rounded receipt total across its lines so the printed lines
 * add up to the printed total.
 *
 * Rounding each line on its own is what breaks a receipt: three XOF lines of
 * 0.40 each round to 0, 0, 0 under a total of 1, and four lines of 12.50 round
 * up to 52 under a total of 50. The customer sees a column that does not sum.
 *
 * Largest-remainder allocation instead: floor every line, then hand the
 * leftover units to the lines with the biggest discarded fraction. Every line
 * stays within one minor unit of its true value and the column always totals
 * exactly `totalMinor`.
 *
 * `values` are stored money strings; `totalMinor` is the authoritative total
 * already converted with {@link moneyToReceiptMinor}.
 */
export function allocateReceiptLineMinor(
  values: readonly (string | number | null | undefined)[],
  currency: string | null | undefined,
  totalMinor: number,
): number[] {
  if (values.length === 0) return [];

  const decimals = getCurrencyMinorUnits(currency);
  const shift = MONEY_STORAGE_DECIMALS - decimals;
  const divisor = shift <= 0 ? 1 : 10 ** shift;

  const storage = values.map((value) => {
    const parsed = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(parsed)
      ? Math.round(parsed * 10 ** MONEY_STORAGE_DECIMALS)
      : 0;
  });

  // A currency already at storage scale needs no allocation: the lines are
  // exact, and forcing them to match a total they do not sum to would hide a
  // genuine pricing discrepancy.
  if (divisor === 1) return storage;

  const floors = storage.map((value) => Math.floor(value / divisor));
  const allocated = floors.reduce((sum, value) => sum + value, 0);
  let remaining = totalMinor - allocated;

  if (remaining === 0) return floors;

  // Hand out (or reclaim) one unit at a time, biggest discarded fraction
  // first, so the lines that lost the most round up before the others.
  const order = storage
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value / divisor) * divisor,
    }))
    .sort((left, right) => right.remainder - left.remainder);

  const result = [...floors];
  const step = remaining > 0 ? 1 : -1;
  for (let cursor = 0; remaining !== 0 && cursor < order.length; cursor += 1) {
    const target = order[step > 0 ? cursor : order.length - 1 - cursor];
    if (!target) break;
    result[target.index] += step;
    remaining -= step;
  }

  return result;
}
