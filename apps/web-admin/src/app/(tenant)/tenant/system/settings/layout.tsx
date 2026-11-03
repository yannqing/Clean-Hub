import { getAuthSessionQuery } from "@/features/auth/queries";
import { TenantSettingsWorkspace } from "@/features/tenant/settings/components";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantSettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [settings, authContext] = await Promise.all([
    getTenantSettingsQuery(requestOptions).catch(() => undefined),
    getAuthSessionQuery(requestOptions),
  ]);

  return (
    <TenantSettingsWorkspace
      initialAuthContext={authContext ?? undefined}
      initialSettings={settings}
    >
      {children}
    </TenantSettingsWorkspace>
  );
}
