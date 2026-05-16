export type SaasUsersErrorCode =
  | "SAAS_USER_EMAIL_CONFLICT"
  | "SAAS_USER_PHONE_CONFLICT"
  | "SAAS_USER_ROLE_INVALID";

export class SaasUsersError extends Error {
  constructor(
    public readonly code: SaasUsersErrorCode,
    message: string,
    public readonly status: 409 | 422,
  ) {
    super(message);
    this.name = "SaasUsersError";
  }
}
