export type TenantBranchesErrorCode =
  | "BRANCH_NOT_FOUND"
  | "BRANCH_VERSION_CONFLICT";

export class TenantBranchesError extends Error {
  constructor(
    readonly code: TenantBranchesErrorCode,
    message: string,
    readonly status: 404 | 409 | 422 = 422,
  ) {
    super(message);
    this.name = "TenantBranchesError";
  }
}
