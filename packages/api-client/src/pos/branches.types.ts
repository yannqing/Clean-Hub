import type { BranchSummary } from "../tenant/branches/branches.types";

/**
 * POS-facing branch DTO. The POS terminal only reads its own branch context,
 * so it reuses the tenant BranchSummary shape.
 */
export type PosBranchSummary = BranchSummary & {
  merchantName: string;
};
