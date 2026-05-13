export type AuthErrorCode =
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
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
