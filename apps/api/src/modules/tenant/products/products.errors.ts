export type TenantProductsErrorCode =
  | "PRODUCT_BRANCH_NOT_FOUND"
  | "PRODUCT_CATEGORY_NOT_FOUND"
  | "PRODUCT_CATEGORY_INACTIVE"
  | "PRODUCT_CATEGORY_ATTRIBUTE_INVALID"
  | "PRODUCT_CATEGORY_ATTRIBUTE_REQUIRED"
  | "PRODUCT_SKU_CODE_DUPLICATE"
  | "PRODUCT_BARCODE_DUPLICATE"
  | "PRODUCT_MEDIA_FORBIDDEN"
  | "PRODUCT_MEDIA_NOT_FOUND"
  | "PRODUCT_MEDIA_INVALID"
  | "PRODUCT_MEDIA_CONFLICT"
  | "PRODUCT_MEDIA_STORAGE_ERROR";

export class TenantProductsError extends Error {
  constructor(
    readonly code: TenantProductsErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 | 500,
  ) {
    super(message);
    this.name = "TenantProductsError";
  }
}
