export type TenantServicesErrorCode =
  | "TENANT_CONTEXT_REQUIRED"
  | "TENANT_NOT_ACTIVE"
  | "FEATURE_DISABLED"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_CATEGORY_NOT_FOUND"
  | "SERVICE_CATEGORY_INACTIVE"
  | "SERVICE_CATEGORY_BUSINESS_LINE_MISMATCH"
  | "SERVICE_NAME_DUPLICATE"
  | "SERVICE_VERSION_CONFLICT";

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
