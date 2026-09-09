import { TenantPaymentSettingsView } from "@/features/tenant/payment-integrations";
import { BranchPaymentSettingsView } from "@/features/tenant/settings/components";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
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

  const branchResult = await getBranchListQuery({}, options)
    .then((branches) => ({ branches, error: undefined }))
    .catch((error: unknown) => ({
      branches: undefined,
      error: error instanceof Error ? error.message : "门店列表加载失败。",
    }));

  // Mirrors findEnabledTenantPaymentProviders on the API: a provider only
  // reaches the register once it is verified and switched on for POS.
  const mobileMoneyReady = integrations.some(
    (integration) =>
      integration.verificationStatus === "verified" && integration.posEnabled,
  );

  return (
    <div className="space-y-4">
      <BranchPaymentSettingsView
        initialBranches={branchResult.branches}
        initialError={branchResult.error}
        mobileMoneyReady={mobileMoneyReady}
        section="payments"
      />
      <TenantPaymentSettingsView
        initialIntegrations={integrations}
        loadError={loadError}
      />
    </div>
  );
}
