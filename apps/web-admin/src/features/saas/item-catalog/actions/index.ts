import type {
  SavePlatformItemGroupRequest,
  TenantItemCatalogSelection,
} from "@cleanhub/api-client";
import { webAdminApi } from "@/lib/api-client";

export const savePlatformItemGroupAction = (
  id: string,
  input: SavePlatformItemGroupRequest,
) => webAdminApi.saas.itemCatalog.updateGroup(id, input);
export const saveTenantItemCatalogAction = (
  id: string,
  selection: TenantItemCatalogSelection,
  version: number,
) => webAdminApi.saas.itemCatalog.updateTenant(id, selection, version);
