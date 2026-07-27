import { getAuthSessionQuery } from "@/features/auth/queries";
import { TenantProductsView } from "@/features/tenant/products/components/tenant-products-view";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantProductsPage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  return <TenantProductsView canEditProducts={authContext?.role === "owner"} />;
}
