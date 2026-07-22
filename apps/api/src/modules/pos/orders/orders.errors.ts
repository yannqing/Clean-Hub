export type PosOrderErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_ITEM_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_SUPPORTED"
  | "PAYMENT_REFERENCE_CONFLICT"
  | "PAYMENT_ALREADY_PENDING"
  | "PAYMENT_ALREADY_RESOLVED"
  | "PAYMENT_AMOUNT_EXCEEDED"
  | "PAYMENT_CONFIRMATION_FORBIDDEN"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DISABLED"
  | "BRANCH_NOT_ALLOWED"
  | "SERVICE_TICKET_NOT_FOUND"
  | "SERVICE_TICKET_EMPTY"
  | "TICKET_ITEM_ALREADY_ORDERED"
  | "INVALID_STATUS_TRANSITION"
  | "ORDER_ALREADY_PAID"
  | "ORDER_NOT_PAID"
  | "ORDER_CANNOT_BE_DELETED"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR";

export class PosOrderError extends Error {
  constructor(
    readonly code: PosOrderErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "PosOrderError";
  }
}
