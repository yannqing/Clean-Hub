/**
 * Domain errors for POS customer management (accounts + profiles).
 *
 * Mirrors the TenantUserError pattern: each error carries a stable `code`
 * and an HTTP `status` so the controller can map it to a structured
 * response without leaking implementation details.
 */
export type PosCustomerErrorCode =
  | "POS_ACCOUNT_NOT_FOUND"
  | "POS_CUSTOMER_NOT_FOUND"
  | "POS_PHONE_CONFLICT"
  | "POS_EMAIL_CONFLICT"
  | "POS_ACCOUNT_DISABLED"
  | "POS_CUSTOMER_ALREADY_DISABLED"
  | "POS_CUSTOMER_NOT_DISABLED"
  | "POS_PHONE_OR_EMAIL_REQUIRED";

export class PosCustomerError extends Error {
  constructor(
    public readonly code: PosCustomerErrorCode,
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "PosCustomerError";
  }
}
