export type TenantFinanceErrorCode = "FINANCE_BRANCH_NOT_FOUND";

export class TenantFinanceError extends Error {
  constructor(
    readonly code: TenantFinanceErrorCode,
    message: string,
    readonly status: 404,
  ) {
    super(message);
    this.name = "TenantFinanceError";
  }
}
