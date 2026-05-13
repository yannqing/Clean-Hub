import { PagePlaceholder } from "@/components/app-shell";

type TenantSettingsPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

export default async function TenantSettingsPage({
  params,
}: TenantSettingsPageProps) {
  const { tenantId } = await params;

  return (
    <PagePlaceholder
      description={`Platform-controlled settings placeholder for tenant ${tenantId}.`}
      items={["Tenant status", "Feature flags", "Limits", "Compliance settings"]}
      title="Tenant Settings"
    />
  );
}
