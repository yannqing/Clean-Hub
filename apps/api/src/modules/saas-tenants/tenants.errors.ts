export type SaasTenantsErrorCode =
  | "SAAS_TENANT_NOT_FOUND"
  | "SAAS_TENANT_UPDATE_EMPTY"
  | "SAAS_TENANT_PRESSING_CODE_CONFLICT";

export class SaasTenantsError extends Error {
  constructor(
    public readonly code: SaasTenantsErrorCode,
    message: string,
    public readonly status: 404 | 409 | 422,
  ) {
    super(message);
    this.name = "SaasTenantsError";
  }
}
