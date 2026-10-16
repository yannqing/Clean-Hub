import { notFound } from "next/navigation";

import { getMyBranchQuery } from "@/features/branches/queries";
import { CatalogDetailView } from "@/features/catalog/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import { getCurrentUser } from "@/lib/auth";

type CatalogProductDetailPageProps = {
  params: Promise<{ productSkuId: string }>;
};

export default async function CatalogProductDetailPage({
  params,
}: CatalogProductDetailPageProps) {
  const [{ productSkuId }, branch, user] = await Promise.all([
    params,
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
  ]);
  const branchId = user?.terminalBranchId ?? branch?.id;
  if (!branchId) {
    notFound();
  }

  const catalog = await getPosCatalogQuery({ branchId, includeAll: true });
  const product = catalog.products.find(
    (item) => item.productSkuId === productSkuId,
  );
  if (!product) {
    notFound();
  }

  return (
    <CatalogDetailView
      branchName={branch?.name ?? "—"}
      item={product}
      kind="product"
    />
  );
}
