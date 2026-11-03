export type TenantBranchesErrorCode =
  | "BRANCH_NOT_FOUND"
  | "BRANCH_VERSION_CONFLICT"
  | "BRANCH_LOGO_INVALID";

export class TenantBranchesError extends Error {
  constructor(
    readonly code: TenantBranchesErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 | 500 = 422,
  ) {
    super(message);
    this.name = "TenantBranchesError";
  }
}
