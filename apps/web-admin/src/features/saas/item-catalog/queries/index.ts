import { webAdminApi } from "@/lib/api-client";

export const getPlatformItemCatalogQuery = () =>
  webAdminApi.saas.itemCatalog.list();
export const getTenantItemCatalogQuery = (tenantId: string) =>
  webAdminApi.saas.itemCatalog.getTenant(tenantId);
