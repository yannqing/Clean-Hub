import { notFound } from "next/navigation";

import { getMyBranchQuery } from "@/features/branches/queries";
import { CatalogDetailView } from "@/features/catalog/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import { getCurrentUser } from "@/lib/auth";

type CatalogServiceDetailPageProps = {
  params: Promise<{ serviceId: string }>;
};

export default async function CatalogServiceDetailPage({
  params,
}: CatalogServiceDetailPageProps) {
  const [{ serviceId }, branch, user] = await Promise.all([
    params,
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
  ]);
  const branchId = user?.terminalBranchId ?? branch?.id;
  if (!branchId) {
    notFound();
  }

  const catalog = await getPosCatalogQuery({ branchId, includeAll: true });
  const service = catalog.data.find((item) => item.id === serviceId);
  if (!service) {
    notFound();
  }

  return (
    <CatalogDetailView
      branchName={branch?.name ?? "—"}
      item={service}
      kind="service"
    />
  );
}
