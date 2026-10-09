export type SaasUsersErrorCode =
  | "SAAS_USER_RESET_REASON_INVALID"
  | "SAAS_USER_PIN_GENERATION_FAILED"
  | "SAAS_USER_CANNOT_RESET_OWN_CREDENTIALS"
  | "SAAS_USER_NOT_FOUND"
  | "SAAS_USER_UPDATE_EMPTY"
  | "SAAS_USER_EMAIL_CONFLICT"
  | "SAAS_USER_PHONE_CONFLICT"
  | "SAAS_USER_ROLE_INVALID"
  | "SAAS_USER_CANNOT_DISABLE_SELF"
  | "SAAS_USER_CANNOT_RESET_OWN_PASSWORD"
  | "SAAS_USER_LAST_SUPER_ADMIN"
  | "SAAS_USER_ROLES_INVALID";

export class SaasUsersError extends Error {
  constructor(
    public readonly code: SaasUsersErrorCode,
    message: string,
    public readonly status: 404 | 409 | 422 | 503,
  ) {
    super(message);
    this.name = "SaasUsersError";
  }
}
