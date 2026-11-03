import { getAuthSessionQuery } from "@/features/auth/queries";
import { TenantProductsView } from "@/features/tenant/products/components/tenant-products-view";
import { ProductAccessNotice } from "@/features/tenant/products/components/product-access-notice";
import { getProductAccessQuery } from "@/features/tenant/products/queries/get-product-access.query";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantProductsPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const [authContext, access] = await Promise.all([
    getAuthSessionQuery(requestOptions),
    getProductAccessQuery(requestOptions),
  ]);

  if (access !== "enabled") {
    return <ProductAccessNotice access={access} />;
  }

  return <TenantProductsView canEditProducts={authContext?.role === "owner"} />;
}
