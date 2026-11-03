export type PosHardwareErrorCode =
  | "POS_HARDWARE_NOT_FOUND"
  | "POS_HARDWARE_NOT_PRINTER"
  | "POS_HARDWARE_PRINTER_ALREADY_BOUND"
  | "POS_HARDWARE_VERSION_CONFLICT";

export class PosHardwareError extends Error {
  constructor(
    readonly code: PosHardwareErrorCode,
    message: string,
    readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "PosHardwareError";
  }
}
