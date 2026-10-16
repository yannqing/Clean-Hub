import { BranchCreateView } from "@/features/tenant/branches/components";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";

export default async function NewBranchPage() {
  // 使用你的分支逻辑：尝试获取租户默认设置，如果失败则提供警告信息
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
    <BranchCreateView
      defaultsWarning={result.defaultsWarning}
      initialDefaultCurrency={result.settings?.defaultCurrency}
      initialDefaultLanguage={result.settings?.defaultLanguage}
    />
  );
}
