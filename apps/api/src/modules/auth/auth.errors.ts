export type AuthErrorCode =
  | "ACCOUNT_LOCKED"
  | "FORBIDDEN"
  | "FEATURE_DISABLED"
  | "INVALID_CREDENTIALS"
  | "PASSWORD_POLICY_VIOLATION"
  | "POS_TERMINAL_CREDENTIAL_INVALID"
  | "POS_TERMINAL_DISABLED"
  | "POS_TERMINAL_ENROLLMENT_REQUIRED"
  | "TENANT_CODE_REQUIRED"
  | "USER_DISABLED"
  | "USER_SUSPENDED"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_REUSE_DETECTED"
  | "AUTH_CONFIG_INVALID";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function invalidCredentials(): AuthError {
  return new AuthError("INVALID_CREDENTIALS", "Invalid credentials.");
}
