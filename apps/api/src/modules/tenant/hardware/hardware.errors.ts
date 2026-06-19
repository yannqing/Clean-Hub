export type HardwareErrorCode = "HARDWARE_NOT_FOUND";

export class HardwareError extends Error {
  constructor(
    public readonly code: HardwareErrorCode,
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "HardwareError";
  }
}
