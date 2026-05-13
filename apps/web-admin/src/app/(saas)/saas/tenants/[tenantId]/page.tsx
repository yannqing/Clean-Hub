import { PagePlaceholder } from "@/components/app-shell";

type TenantDetailPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { tenantId } = await params;

  return (
    <PagePlaceholder
      description={`Tenant detail placeholder for tenant ${tenantId}.`}
      items={["Overview", "Branches", "Users", "Status", "Audit"]}
      title="Tenant Detail"
    />
  );
}
