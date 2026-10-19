/** Stable processing families. Names and available articles are database data. */
export const SERVICE_ITEM_TYPES = ["cloth", "shoe", "carpet", "car"] as const;
export type ServiceItemType = (typeof SERVICE_ITEM_TYPES)[number];
export type CatalogTranslations = Record<"en" | "fr" | "zh-CN", string>;

export type PlatformServiceArticle = {
  id: string;
  names: CatalogTranslations;
  descriptions: CatalogTranslations;
  enabled: boolean;
  sortOrder: number;
};

export type PlatformServiceItemGroup = {
  id: string;
  itemType: ServiceItemType;
  names: CatalogTranslations;
  descriptions: CatalogTranslations;
  enabled: boolean;
  sortOrder: number;
  version: number;
  items: PlatformServiceArticle[];
};

export type TenantItemCatalogSelection = {
  itemTypes: ServiceItemType[];
  itemIds: string[];
};

export type TenantServiceItemCatalog = {
  /** Null is the compatibility mode for installations predating this catalog. */
  selection: TenantItemCatalogSelection | null;
  groups: PlatformServiceItemGroup[];
};

export function serviceCatalogText(
  values: CatalogTranslations,
  locale: string,
): string {
  return values[locale === "zh-CN" ? "zh-CN" : locale === "fr" ? "fr" : "en"];
}

/** No implicit expansion: new SaaS articles require a new tenant selection. */
export function selectedServiceItemGroups(
  catalog: TenantServiceItemCatalog,
): PlatformServiceItemGroup[] {
  const selection = catalog.selection;
  return catalog.groups
    .filter(
      (group) =>
        group.enabled &&
        (!selection || selection.itemTypes.includes(group.itemType)),
    )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.enabled && (!selection || selection.itemIds.includes(item.id)),
      ),
    }));
}
