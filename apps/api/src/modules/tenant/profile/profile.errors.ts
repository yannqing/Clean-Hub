export type TenantProfileErrorCode =
  | "TENANT_PROFILE_NOT_FOUND"
  | "TENANT_PROFILE_UPDATE_EMPTY"
  | "CURRENT_PASSWORD_INCORRECT"
  | "NEW_PASSWORD_UNCHANGED"
  | "CURRENT_PIN_INCORRECT"
  | "NEW_PIN_UNCHANGED"
  | "NEW_PIN_CONFLICT"
  | "PASSWORD_POLICY_VIOLATION"
  | "TENANT_PROFILE_EMAIL_CONFLICT"
  | "TENANT_LOGIN_SESSION_NOT_FOUND"
  | "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN"
  | "TENANT_PROFILE_CONFLICT";

export class TenantProfileError extends Error {
  constructor(
    readonly code: TenantProfileErrorCode,
    message: string,
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "TenantProfileError";
  }
}
