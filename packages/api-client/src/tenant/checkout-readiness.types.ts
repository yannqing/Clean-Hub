export type PosTaxReadiness = {
  ready: boolean;
  code: string | null;
  message: string | null;
  checks: {
    countrySet: boolean;
    templateAvailable: boolean;
    templateApplied: boolean;
    taxEnabled: boolean;
    taxRegistrationNumberSet: boolean;
    taxLabelSet: boolean;
    currencyMatches: boolean;
  };
  issues: Array<{ code: string; message: string }>;
};

export type TenantCheckoutReadiness = {
  ready: boolean;
  tenantActive: boolean;
  activeOwnerCount: number;
  activeBranchCount: number;
  activeCatalogItemCount: number;
  enrolledTerminalCount: number;
  taxEnabled: boolean;
  taxTemplateApplied: boolean;
  taxRegistrationNumberSet: boolean;
  taxReadiness: PosTaxReadiness;
  branches: Array<{
    id: string;
    name: string;
    currency: string;
    catalogReady: boolean;
    enrolledTerminalCount: number;
    taxReadiness: PosTaxReadiness;
    ready: boolean;
  }>;
};
