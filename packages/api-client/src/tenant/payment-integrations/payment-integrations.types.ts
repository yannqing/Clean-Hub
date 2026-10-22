export type TenantPaymentProvider = "wave" | "orange_money";
export type PaymentIntegrationVerificationStatus =
  | "not_configured"
  | "verified"
  | "invalid";

export type TenantPaymentIntegrationSummary = {
  provider: TenantPaymentProvider;
  configured: boolean;
  credentialHint: string | null;
  verificationStatus: PaymentIntegrationVerificationStatus;
  posEnabled: boolean;
  verifiedAt: string | null;
  updatedAt: string | null;
  version: number | null;
  lastVerificationError: string | null;
};

export type ConfigureWavePaymentIntegrationRequest = {
  apiKey: string;
  signingSecret?: string;
  posEnabled?: boolean;
};

export type ConfigureOrangeMoneyPaymentIntegrationRequest = {
  clientId: string;
  clientSecret: string;
  merchantKey: string;
  posEnabled?: boolean;
};

export type ConfigureTenantPaymentIntegrationRequest =
  | ConfigureWavePaymentIntegrationRequest
  | ConfigureOrangeMoneyPaymentIntegrationRequest;

export type UpdateTenantPaymentIntegrationRequest = {
  posEnabled: boolean;
};
