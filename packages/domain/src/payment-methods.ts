export const POS_PAYMENT_METHODS = ["cash", "card", "app"] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

/**
 * Card is recognised for historical orders but cannot be accepted today: the
 * in-store terminal has no EMV kernel or PIN pad (its NFC reader is Mifare
 * only), so a card sale could only ever be a cashier typing in an outcome
 * nobody can verify. Selecting it anywhere is blocked until a certified
 * payment terminal is integrated.
 */
export const LOCKED_POS_PAYMENT_METHODS = [
  "card",
] as const satisfies readonly PosPaymentMethod[];

export type LockedPosPaymentMethod =
  (typeof LOCKED_POS_PAYMENT_METHODS)[number];

export type SelectablePosPaymentMethod = Exclude<
  PosPaymentMethod,
  LockedPosPaymentMethod
>;

export const SELECTABLE_POS_PAYMENT_METHODS = POS_PAYMENT_METHODS.filter(
  (method): method is SelectablePosPaymentMethod =>
    !(LOCKED_POS_PAYMENT_METHODS as readonly PosPaymentMethod[]).includes(
      method,
    ),
);

export function isLockedPosPaymentMethod(
  method: PosPaymentMethod,
): method is LockedPosPaymentMethod {
  return (LOCKED_POS_PAYMENT_METHODS as readonly PosPaymentMethod[]).includes(
    method,
  );
}
