export type TenantCustomersErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_PHONE_CONFLICT"
  | "ACCOUNT_EMAIL_CONFLICT"
  | "ACCOUNT_CONTACT_REQUIRED"
  | "ACCOUNT_VERSION_CONFLICT"
  | "INVALID_TIMELINE_CURSOR"
  | "COMMENT_NOT_FOUND"
  | "COMMENT_FORBIDDEN"
  | "COMMENT_VERSION_CONFLICT"
  | "COMMENT_IDEMPOTENCY_CONFLICT"
  | "COMMENT_ATTACHMENT_NOT_FOUND"
  | "COMMENT_ATTACHMENT_INVALID"
  | "COMMENT_ATTACHMENT_CONFLICT"
  | "MENTIONED_USER_NOT_FOUND";

export class TenantCustomersError extends Error {
  constructor(
    public readonly code: TenantCustomersErrorCode,
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 422 = 404,
  ) {
    super(message);
    this.name = "TenantCustomersError";
  }
}
