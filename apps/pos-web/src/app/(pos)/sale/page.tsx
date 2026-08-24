import { getCurrentUser } from "@/lib/auth";
import { getMyBranchQuery } from "@/features/branches/queries";
import { CartSaleView } from "@/features/cart/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";

export default async function SalePage() {
  const [branch, user] = await Promise.all([
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
  ]);
  const branchId = user?.terminalBranchId ?? branch?.id;
  const catalog = branchId
    ? await getPosCatalogQuery({ branchId, includeAll: true }).catch(() => ({
        data: [],
        products: [],
      }))
    : { data: [], products: [] };

  return (
    <CartSaleView
      branch={branch}
      canManageSensitiveOperations={
        user?.role === "owner" || user?.role === "manager"
      }
      products={catalog.products}
      services={catalog.data}
    />
  );
}

export function generateMetadata() {
  return { title: "销售" };
}
