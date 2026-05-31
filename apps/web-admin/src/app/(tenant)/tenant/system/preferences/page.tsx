import { TenantSettingsView } from "@/features/tenant/settings/components";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantSystemPreferencesPage() {
  const settings = await getTenantSettingsQuery(
    await getTenantServerApiRequestOptions(),
  ).catch(() => undefined);

  return <TenantSettingsView initialSettings={settings} />;
}
