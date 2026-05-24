export type TenantServicesErrorCode =
  | "TENANT_CONTEXT_REQUIRED"
  | "TENANT_NOT_ACTIVE"
  | "TENANT_FEATURE_DISABLED"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_NAME_DUPLICATE";

export class TenantServicesError extends Error {
  constructor(
    readonly code: TenantServicesErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "TenantServicesError";
  }
}
