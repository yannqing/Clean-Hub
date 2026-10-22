export type TenantNotificationErrorCode =
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_ARCHIVED"
  | "VALIDATION_ERROR";

export class TenantNotificationError extends Error {
  constructor(
    readonly code: TenantNotificationErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "TenantNotificationError";
  }
}
