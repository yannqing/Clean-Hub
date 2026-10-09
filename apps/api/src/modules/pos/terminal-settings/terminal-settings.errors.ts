export type PosTerminalSettingsErrorCode =
  | "TERMINAL_SETTINGS_NOT_FOUND"
  | "TERMINAL_SETTINGS_ALREADY_EXISTS"
  | "BRANCH_NOT_ALLOWED"
  | "POS_TERMINAL_REQUIRED"
  | "MOBILE_MONEY_INTEGRATION_REQUIRED"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR";

export class PosTerminalSettingsError extends Error {
  constructor(
    readonly code: PosTerminalSettingsErrorCode,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "PosTerminalSettingsError";
  }
}
