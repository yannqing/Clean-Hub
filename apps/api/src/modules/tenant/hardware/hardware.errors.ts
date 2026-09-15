export type HardwareErrorCode =
  | "HARDWARE_NOT_FOUND"
  | "HARDWARE_TERMINAL_NOT_FOUND"
  | "HARDWARE_BUILT_IN_READ_ONLY"
  | "HARDWARE_VERSION_CONFLICT";

export class HardwareError extends Error {
  constructor(
    public readonly code: HardwareErrorCode,
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "HardwareError";
  }
}
