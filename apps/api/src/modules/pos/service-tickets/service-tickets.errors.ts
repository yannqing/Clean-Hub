export type ServiceTicketErrorCode =
  | "SERVICE_TICKET_NOT_FOUND"
  | "SERVICE_TICKET_ITEM_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_ITEM_STATUS_TRANSITION"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DISABLED"
  | "BRANCH_NOT_ALLOWED"
  | "FEATURE_DISABLED"
  | "PICKUP_REQUIRES_SETTLEMENT"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR";

export class ServiceTicketError extends Error {
  constructor(
    readonly code: ServiceTicketErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "ServiceTicketError";
  }
}
