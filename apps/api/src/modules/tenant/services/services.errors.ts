export type TenantServicesErrorCode =
  | "TENANT_CONTEXT_REQUIRED"
  | "TENANT_NOT_ACTIVE"
  | "FEATURE_DISABLED"
  | "SERVICE_NOT_FOUND"
  | "SERVICE_CATEGORY_NOT_FOUND"
  | "SERVICE_CATEGORY_INACTIVE"
  | "SERVICE_CATEGORY_BUSINESS_LINE_MISMATCH"
  | "SERVICE_BRANCH_NOT_FOUND"
  | "SERVICE_BRANCH_INACTIVE"
  | "SERVICE_BRANCH_REQUIRED"
  | "SERVICE_NAME_DUPLICATE"
  | "SERVICE_CODE_DUPLICATE"
  | "SERVICE_COMPARE_AT_PRICE_INVALID"
  | "SERVICE_MEDIA_FORBIDDEN"
  | "SERVICE_MEDIA_NOT_FOUND"
  | "SERVICE_MEDIA_CONFLICT"
  | "SERVICE_MEDIA_INVALID"
  | "SERVICE_MEDIA_STORAGE_ERROR"
  | "SERVICE_VERSION_CONFLICT";

export class TenantServicesError extends Error {
  constructor(
    readonly code: TenantServicesErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 | 500 = 422,
  ) {
    super(message);
    this.name = "TenantServicesError";
  }
}
