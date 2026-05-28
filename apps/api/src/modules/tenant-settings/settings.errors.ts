export class TenantSettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 404 | 422,
  ) {
    super(message);
    this.name = "TenantSettingsError";
  }
}
