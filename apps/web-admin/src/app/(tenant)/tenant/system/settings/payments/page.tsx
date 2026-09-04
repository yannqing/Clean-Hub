import { TenantPaymentSettingsView } from "@/features/tenant/payment-integrations";
import { getTenantPaymentIntegrationsQuery } from "@/features/tenant/payment-integrations/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const EMPTY_INTEGRATIONS = [
  {
    provider: "wave",
    configured: false,
    credentialHint: null,
    verificationStatus: "not_configured",
    posEnabled: false,
    verifiedAt: null,
    updatedAt: null,
    version: null,
    lastVerificationError: null,
  },
  {
    provider: "orange_money",
    configured: false,
    credentialHint: null,
    verificationStatus: "not_configured",
    posEnabled: false,
    verifiedAt: null,
    updatedAt: null,
    version: null,
    lastVerificationError: null,
  },
] as const;

export default async function TenantPaymentSettingsPage() {
  const options = await getTenantServerApiRequestOptions();
  let integrations;
  let loadError: string | null = null;

  try {
    integrations = await getTenantPaymentIntegrationsQuery(options);
  } catch (error) {
    integrations = [...EMPTY_INTEGRATIONS];
    loadError = error instanceof Error ? error.message : "支付设置加载失败。";
  }

  return (
    <TenantPaymentSettingsView
      initialIntegrations={integrations}
      loadError={loadError}
    />
  );
}
