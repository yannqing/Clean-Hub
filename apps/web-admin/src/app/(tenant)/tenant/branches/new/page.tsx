import { BranchCreateView } from "@/features/tenant/branches/components";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";

export default async function NewBranchPage() {
  const result = await getTenantSettingsQuery(
    await getTenantServerApiRequestOptions(),
  )
    .then((settings) => ({ settings, defaultsWarning: undefined }))
    .catch(() => ({
      settings: undefined,
      defaultsWarning:
        "Tenant defaults could not be loaded. Review language and currency before creating the branch.",
    }));

  return (
    <BranchCreateView
      defaultsWarning={result.defaultsWarning}
      initialDefaultCurrency={result.settings?.defaultCurrency}
      initialDefaultLanguage={result.settings?.defaultLanguage}
    />
  );
}
