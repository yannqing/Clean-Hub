import { TenantDetailView } from "@/features/saas/tenants/components";

type TenantDetailPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { tenantId } = await params;

  return <TenantDetailView tenantId={tenantId} />;
}
