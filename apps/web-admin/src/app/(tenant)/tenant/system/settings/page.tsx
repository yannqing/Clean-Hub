import type { AuthContext } from "@cleanhub/api-client";

import { TenantSettingsView } from "@/features/tenant/settings/components";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export default async function TenantSystemSettingsPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [settings, authContext] = await Promise.all([
    getTenantSettingsQuery(requestOptions).catch(() => undefined),
    webAdminApi.http
      .get<AuthContext>("/auth/me", requestOptions)
      .catch(() => undefined),
  ]);

  return (
    <TenantSettingsView
      initialAuthContext={authContext}
      initialSettings={settings}
    />
  );
}
