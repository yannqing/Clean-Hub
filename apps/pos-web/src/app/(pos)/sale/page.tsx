import { getCurrentUser } from "@/lib/auth";
import { getMyBranchQuery } from "@/features/branches/queries";
import { CartSaleView } from "@/features/cart/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import {
  getCurrentRegisterQuery,
  getCurrentShiftQuery,
} from "@/features/shift-handover/queries";

export default async function SalePage() {
  const [branch, user, currentShiftResult, registerResult] = await Promise.all([
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
    getCurrentShiftQuery().then(
      (value) => ({ available: true, value }),
      () => ({ available: false, value: null }),
    ),
    getCurrentRegisterQuery().then(
      (value) => ({ available: true, value }),
      () => ({ available: false, value: null }),
    ),
  ]);
  const branchId = user?.terminalBranchId ?? branch?.id;
  const catalogResult = branchId
    ? await getPosCatalogQuery({ branchId, includeAll: true }).catch(
        () => null,
      )
    : null;
  const catalog = catalogResult ?? { data: [], products: [] };

  return (
    <CartSaleView
      branch={branch}
      canManageSensitiveOperations={
        user?.role === "owner" || user?.role === "manager"
      }
      catalogAvailable={catalogResult !== null}
      currentShift={currentShiftResult.value}
      shiftAvailable={currentShiftResult.available}
      register={registerResult.value}
      registerAvailable={registerResult.available}
      products={catalog.products}
      services={catalog.data}
    />
  );
}

export function generateMetadata() {
  return { title: "销售" };
}
