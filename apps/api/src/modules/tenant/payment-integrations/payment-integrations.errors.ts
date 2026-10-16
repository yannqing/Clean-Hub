export class TenantPaymentIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 404 | 409 | 422 | 503 = 422,
  ) {
    super(message);
    this.name = "TenantPaymentIntegrationError";
  }
}
