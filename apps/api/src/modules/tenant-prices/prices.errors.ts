export type TenantPricesErrorCode =
  | "TENANT_CONTEXT_REQUIRED"
  | "TENANT_NOT_ACTIVE"
  | "FEATURE_DISABLED"
  | "PRICE_BOOK_NOT_FOUND"
  | "PRICE_BOOK_NAME_DUPLICATE";

export class TenantPricesError extends Error {
  constructor(
    readonly code: TenantPricesErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "TenantPricesError";
  }
}
