import { pgEnum } from "drizzle-orm/pg-core";

export const posPaymentMethodEnum = pgEnum("pos_payment_method", [
  "cash",
  "card",
  "app",
]);

/**
 * How a branch is expected to account for cash. This is deliberately
 * independent from whether an electronic drawer is physically connected.
 */
export const posCashHandlingModeEnum = pgEnum("pos_cash_handling_mode", [
  "none",
  "untracked",
  "shared_drawer",
  "cash_in_hand",
]);
