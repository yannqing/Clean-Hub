export type PosStaffErrorCode =
  | "POS_TERMINAL_REQUIRED"
  | "BRANCH_NOT_FOUND"
  | "STAFF_NOT_FOUND"
  | "SHIFT_NOT_FOUND"
  | "SHIFT_ALREADY_OPEN"
  | "REGISTER_ALREADY_OPEN"
  | "REGISTER_NOT_OPEN"
  | "CASH_SESSION_REQUIRED"
  | "CASH_HANDLING_DISABLED"
  | "CASH_AMOUNT_NOT_PAYABLE"
  | "INVALID_SHIFT_ACTION"
  | "HANDOVER_ALREADY_COMPLETED"
  | "Z_REPORT_NOT_FOUND";

export class PosStaffError extends Error {
  constructor(
    readonly code: PosStaffErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422,
  ) {
    super(message);
    this.name = "PosStaffError";
  }
}
