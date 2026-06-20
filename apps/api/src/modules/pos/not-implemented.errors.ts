/**
 * Shared error for scaffold POS endpoints. Returns HTTP 501 so callers can tell
 * "endpoint exists but not implemented" apart from a 404/500. Delete this file
 * (and its usages) once the real implementations land.
 */
export class PosNotImplementedError extends Error {
  readonly status = 501;
  readonly code = "POS_NOT_IMPLEMENTED";

  constructor(operation: string) {
    super(`POS operation not implemented: ${operation}`);
    this.name = "PosNotImplementedError";
  }
}
