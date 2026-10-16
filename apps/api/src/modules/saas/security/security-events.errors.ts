export class SecurityEventError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 404,
  ) {
    super(message);
    this.name = "SecurityEventError";
  }
}
