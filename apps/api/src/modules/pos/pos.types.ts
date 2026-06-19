import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import type { BranchSummary } from "../tenant/branches/branches.types.js";

/**
 * POS-facing DTOs. The POS terminal is read-mostly for store context, so these
 * mirror the tenant branch summary without the management fields.
 */
export type PosBranchSummary = BranchSummary;

export type PosRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type PosBranchMeInput = {
  authContext: AuthContext;
};
