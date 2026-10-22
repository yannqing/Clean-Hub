export type TenantDiscountsErrorCode =
  | "DISCOUNT_NOT_FOUND"
  | "DISCOUNT_BRANCH_NOT_FOUND"
  | "DISCOUNT_REFERENCE_INVALID"
  | "DISCOUNT_CODE_DUPLICATE"
  | "DISCOUNT_VERSION_CONFLICT"
  | "DISCOUNT_FORBIDDEN";

export class TenantDiscountsError extends Error {
  constructor(
    readonly code: TenantDiscountsErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422,
  ) {
    super(message);
    this.name = "TenantDiscountsError";
  }
}
