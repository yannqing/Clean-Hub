import { webAdminApi } from "@/lib/api-client";

export const getTenantServiceItemCatalogQuery = () => webAdminApi.tenant.itemCatalog.get();
