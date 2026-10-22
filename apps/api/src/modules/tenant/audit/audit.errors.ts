export type TenantAuditErrorCode = "AUDIT_LOG_NOT_FOUND";

export class TenantAuditError extends Error {
  constructor(
    public readonly code: TenantAuditErrorCode,
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "TenantAuditError";
  }
}
