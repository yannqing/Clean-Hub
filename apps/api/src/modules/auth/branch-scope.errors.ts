export type BranchScopeErrorCode = "BRANCH_NOT_FOUND";

export class BranchScopeError extends Error {
  constructor(
    public readonly code: BranchScopeErrorCode,
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "BranchScopeError";
  }
}
