import type {
  CatalogTranslations,
  PlatformServiceItemGroup,
  PlatformServiceArticle,
  TenantItemCatalogSelection,
  TenantServiceItemCatalog,
} from "@cleanhub/domain/service-item-catalog";
import type { ApiClient, ApiRequestOptions } from "./types";

export type {
  CatalogTranslations,
  PlatformServiceItemGroup,
  PlatformServiceArticle,
  TenantItemCatalogSelection,
  TenantServiceItemCatalog,
} from "@cleanhub/domain/service-item-catalog";
export type TenantItemCatalogResponse = TenantServiceItemCatalog & {
  version: number;
};
export type SavePlatformItemGroupRequest = {
  version: number;
  names: CatalogTranslations;
  descriptions: CatalogTranslations;
  enabled: boolean;
  sortOrder: number;
  items: Array<Omit<PlatformServiceArticle, "id"> & { id?: string }>;
};
type Options = Omit<ApiRequestOptions, "method" | "body">;

export function createSaasItemCatalogApi(client: ApiClient) {
  return {
    list: (options?: Options) =>
      client.get<{ data: PlatformServiceItemGroup[] }>(
        "/saas/item-catalog",
        options,
      ),
    updateGroup: (
      groupId: string,
      data: SavePlatformItemGroupRequest,
      options?: Options,
    ) =>
      client.put<PlatformServiceItemGroup>(
        `/saas/item-catalog/${groupId}`,
        data,
        options,
      ),
    getTenant: (tenantId: string, options?: Options) =>
      client.get<TenantItemCatalogResponse>(
        `/saas/tenants/${tenantId}/item-catalog`,
        options,
      ),
    updateTenant: (
      tenantId: string,
      selection: TenantItemCatalogSelection,
      version: number,
      options?: Options,
    ) =>
      client.put<TenantItemCatalogResponse>(
        `/saas/tenants/${tenantId}/item-catalog`,
        { selection, version },
        options,
      ),
  };
}
