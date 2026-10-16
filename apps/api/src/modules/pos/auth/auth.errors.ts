export type PosTerminalAuthErrorCode =
  | "POS_TERMINAL_ALREADY_ENROLLED"
  | "POS_TERMINAL_BRANCH_INACTIVE"
  | "POS_TERMINAL_CREDENTIAL_REVOKED"
  | "POS_TERMINAL_NOT_FOUND"
  | "POS_TERMINAL_SHIFT_OPEN"
  | "POS_TERMINAL_VERSION_CONFLICT";

export class PosTerminalAuthError extends Error {
  constructor(
    readonly code: PosTerminalAuthErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 = 404,
  ) {
    super(message);
    this.name = "PosTerminalAuthError";
  }
}
