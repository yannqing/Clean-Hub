import type { AuthContext } from "../../auth/auth.types.js";

export type SaasOverview = {
  tenantCount: number;
  activeTenantCount: number;
  suspendedTenantCount: number;
  branchCount: number;
  todayOrderCount: number;
  todayRevenueByCurrency: Array<{ currency: string; amount: number }>;
  pendingFeedbackCount: number;
  todoCounts: {
    feedbackTickets: number;
    restoreRequests: number;
    securityEvents: number;
  };
};

export type GetSaasOverviewInput = {
  authContext: AuthContext;
};
