import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type TenantPaymentProvider = "wave" | "orange_money";
export type PaymentIntegrationVerificationStatus =
  | "not_configured"
  | "verified"
  | "invalid";

export type WavePaymentCredentials = {
  provider: "wave";
  apiKey: string;
  signingSecret?: string;
};

export type OrangeMoneyPaymentCredentials = {
  provider: "orange_money";
  clientId: string;
  clientSecret: string;
  merchantKey: string;
};

export type TenantPaymentCredentials =
  | WavePaymentCredentials
  | OrangeMoneyPaymentCredentials;

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

export type ConfigureTenantPaymentIntegrationRequest =
  | {
      provider: "wave";
      apiKey: string;
      signingSecret?: string;
      posEnabled?: boolean;
    }
  | {
      provider: "orange_money";
      clientId: string;
      clientSecret: string;
      merchantKey: string;
      posEnabled?: boolean;
    };

export type UpdateTenantPaymentIntegrationRequest = {
  posEnabled: boolean;
};

export type TenantPaymentIntegrationInput<TData = undefined> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  provider: TenantPaymentProvider;
  data: TData;
};

export type PaymentCredentialVerificationResult = {
  valid: boolean;
  message: string;
};
