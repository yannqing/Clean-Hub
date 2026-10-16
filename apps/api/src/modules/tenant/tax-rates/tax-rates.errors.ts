export type TenantTaxRateErrorCode =
  | "TAX_RATE_NOT_FOUND"
  | "TAX_RATE_NAME_CONFLICT"
  | "TAX_RATE_IN_USE"
  | "TAX_RATE_TEMPLATE_MANAGED"
  | "TAX_RATE_VERSION_CONFLICT";

export class TenantTaxRateError extends Error {
  constructor(
    readonly code: TenantTaxRateErrorCode,
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "TenantTaxRateError";
  }
}
