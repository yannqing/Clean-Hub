/**
 * Money arithmetic now lives in `@cleanhub/domain/money` so the POS modules
 * share one implementation instead of each growing their own. Re-exported here
 * to keep this module's existing import sites working.
 */
export {
  addAmounts,
  amountToCents,
  centsToAmount,
  compareAmounts,
  isPositiveAmount,
  subtractAmounts,
} from "@cleanhub/domain/money";
