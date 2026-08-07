import { TenantDashboardShell } from "@/components/app-shell";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestOptions = await getTenantServerApiRequestOptions();
  const initialAuthContext = await getAuthSessionQuery(requestOptions);

  return (
    <TenantDashboardShell initialAuthContext={initialAuthContext}>
      {children}
    </TenantDashboardShell>
  );
}
