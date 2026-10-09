export class TenantOverviewError extends Error {
  constructor(
    public readonly code: "TENANT_OVERVIEW_NOT_FOUND",
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "TenantOverviewError";
  }
}
