export type TenantUserErrorCode =
  | "TENANT_USER_NOT_FOUND"
  | "TENANT_USER_EMAIL_CONFLICT"
  | "TENANT_USER_PHONE_CONFLICT"
  | "TENANT_USER_BRANCH_UNAUTHORIZED"
  | "TENANT_USER_SELF_DISABLE"
  | "TENANT_USER_ALREADY_DISABLED"
  | "TENANT_USER_NOT_DISABLED"
  | "TENANT_ROLE_NOT_FOUND";

export class TenantUserError extends Error {
  constructor(
    public readonly code: TenantUserErrorCode,
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "TenantUserError";
  }
}
