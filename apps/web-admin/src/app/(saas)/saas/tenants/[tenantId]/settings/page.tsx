import { TenantSettingsView } from "@/features/saas/tenants/components";

type TenantSettingsPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

export default async function TenantSettingsPage({
  params,
}: TenantSettingsPageProps) {
  const { tenantId } = await params;

  return <TenantSettingsView tenantId={tenantId} />;
}
