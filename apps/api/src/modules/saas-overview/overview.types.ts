import type { AuthContext } from "../auth/auth.types.js";

export type SaasOverview = {
  tenantCount: number;
  activeTenantCount: number;
  suspendedTenantCount: number;
  branchCount: number;
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingFeedbackCount: number;
};

export type GetSaasOverviewInput = {
  authContext: AuthContext;
};
