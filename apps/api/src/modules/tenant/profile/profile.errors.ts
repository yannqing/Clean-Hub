export type TenantProfileErrorCode =
  | "TENANT_PROFILE_NOT_FOUND"
  | "TENANT_PROFILE_UPDATE_EMPTY"
  | "CURRENT_PASSWORD_INCORRECT"
  | "NEW_PASSWORD_UNCHANGED"
  | "PASSWORD_POLICY_VIOLATION"
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

