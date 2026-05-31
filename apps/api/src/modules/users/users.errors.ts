export type UserErrorCode =
  | "USER_NOT_FOUND"
  | "USER_ALREADY_DISABLED"
  | "CANNOT_DISABLE_SELF"
  | "TENANT_USER_ROLE_INVALID";

export class UserError extends Error {
  constructor(
    public readonly code: UserErrorCode,
    message: string,
    public readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "UserError";
  }
}
