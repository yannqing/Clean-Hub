import { getCurrentUser } from "@/lib/auth";
import { getMyBranchQuery } from "@/features/branches/queries";
import { CartSaleView } from "@/features/cart/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import {
  getCurrentRegisterQuery,
  getCurrentShiftQuery,
} from "@/features/shift-handover/queries";

export default async function SalePage() {
  const [branch, user, currentShift, register] = await Promise.all([
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
    getCurrentShiftQuery().catch(() => null),
    getCurrentRegisterQuery(),
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
      currentShift={currentShift}
      register={register}
      products={catalog.products}
      services={catalog.data}
    />
  );
}

export function generateMetadata() {
  return { title: "销售" };
}
