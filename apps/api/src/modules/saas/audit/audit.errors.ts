export type AuditErrorCode = "AUDIT_LOG_NOT_FOUND";

export class AuditError extends Error {
  constructor(
    public readonly code: AuditErrorCode,
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "AuditError";
  }
}
