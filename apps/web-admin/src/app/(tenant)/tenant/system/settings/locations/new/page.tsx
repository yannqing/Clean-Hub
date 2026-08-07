import { webAdminRoutes } from "@/config/routes";
import { BranchCreateView } from "@/features/tenant/branches/components";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { TenantSettingsSurface } from "@/features/tenant/settings/components";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";

export default async function NewTenantSettingsLocationPage() {
  const result = await getTenantSettingsQuery(
    await getTenantServerApiRequestOptions(),
  )
    .then((settings) => ({ settings, defaultsWarning: undefined }))
    .catch(() => ({
      settings: undefined,
      defaultsWarning:
        "Tenant defaults could not be displayed. The current tenant currency will still be applied when the branch is created.",
    }));

  return (
    <TenantSettingsSurface>
      <BranchCreateView
        basePath={webAdminRoutes.tenant.system.settingsSections.locations}
        defaultsWarning={result.defaultsWarning}
        embedded
        initialDefaultCurrency={result.settings?.defaultCurrency}
        initialDefaultLanguage={result.settings?.defaultLanguage}
      />
    </TenantSettingsSurface>
  );
}
