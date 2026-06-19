export class TenantBackupsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 422 = 400,
  ) {
    super(message);
    this.name = "TenantBackupsError";
  }
}
