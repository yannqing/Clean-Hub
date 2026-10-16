export type TenantOrdersErrorCode =
  | "ORDER_NOT_FOUND"
  | "INVALID_TIMELINE_CURSOR"
  | "COMMENT_IDEMPOTENCY_CONFLICT"
  | "COMMENT_NOT_FOUND"
  | "COMMENT_FORBIDDEN"
  | "COMMENT_VERSION_CONFLICT"
  | "MENTIONED_USER_NOT_FOUND"
  | "COMMENT_ATTACHMENT_NOT_FOUND"
  | "COMMENT_ATTACHMENT_INVALID"
  | "COMMENT_ATTACHMENT_CONFLICT";

export class TenantOrdersError extends Error {
  constructor(
    readonly code: TenantOrdersErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 404,
  ) {
    super(message);
    this.name = "TenantOrdersError";
  }
}
