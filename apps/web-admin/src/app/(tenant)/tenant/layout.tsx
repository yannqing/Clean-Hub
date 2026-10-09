import { TenantDashboardShell } from "@/components/app-shell";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";

export default async function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [initialAuthContext, initialSettings] = await Promise.all([
    getAuthSessionQuery(requestOptions),
    getTenantSettingsQuery(requestOptions).catch(() => null),
  ]);

  return (
    <TenantDashboardShell
      initialAuthContext={initialAuthContext}
      initialTenantName={initialSettings?.tenantName}
    >
      {children}
    </TenantDashboardShell>
  );
}
