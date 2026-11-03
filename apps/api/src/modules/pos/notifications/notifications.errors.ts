export type PosNotificationErrorCode =
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_ARCHIVED"
  | "VALIDATION_ERROR";

export class PosNotificationError extends Error {
  constructor(
    readonly code: PosNotificationErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "PosNotificationError";
  }
}
