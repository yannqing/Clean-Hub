"use client";

import { useEffect, useState } from "react";
import type { PlatformServiceItemGroup } from "@cleanhub/api-client";
import { serviceCatalogText } from "@cleanhub/domain/service-item-catalog";
import { getTenantServiceItemCatalogQuery } from "../queries/get-item-catalog.query";

/** Names are configured by SaaS; a failed read never replaces saved service data. */
export function useItemTypeNames(locale: string) {
  const [groups, setGroups] = useState<PlatformServiceItemGroup[]>([]);
  useEffect(() => {
    let active = true;
    getTenantServiceItemCatalogQuery().then((data) => { if (active) setGroups(data.groups); }).catch(() => { /* Existing enum labels keep old installations readable. */ });
    return () => { active = false; };
  }, []);
  return (type: string, fallback: string) => {
    const group = groups.find((entry) => entry.itemType === type);
    return group ? serviceCatalogText(group.names, locale) : fallback;
  };
}
