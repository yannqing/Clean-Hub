export type HardwareErrorCode =
  | "HARDWARE_NOT_FOUND"
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
