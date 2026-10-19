import {
  platformServiceArticles,
  platformServiceItemGroups,
  tenantSettings,
  tenants,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import {
  type TenantItemCatalogSelection,
  type PlatformServiceItemGroup,
} from "@cleanhub/domain/service-item-catalog";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { requireSuperAdmin } from "../auth/permission.helper.js";
import {
  findPlatformItemCatalog,
  findTenantItemCatalog,
  persistTenantItemCatalog,
} from "./service-item-catalog.repository.js";
import type { saveCatalogGroupSchema } from "./service-item-catalog.validation.js";

export class ServiceItemCatalogError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 404 | 409 | 422 = 422,
  ) {
    super(message);
  }
}

export function validateCatalogSelection(
  groups: PlatformServiceItemGroup[],
  selection: TenantItemCatalogSelection,
) {
  const available = groups.filter(
    (group) => group.enabled && selection.itemTypes.includes(group.itemType),
  );
  const itemIds = new Set(
    available.flatMap((group) =>
      group.items.filter((item) => item.enabled).map((item) => item.id),
    ),
  );
  if (
    available.length !== selection.itemTypes.length ||
    selection.itemIds.some((id) => !itemIds.has(id))
  )
    throw new ServiceItemCatalogError(
      "ITEM_CATALOG_SELECTION_INVALID",
      "The selected items are no longer available. Refresh the catalog and try again.",
    );
  if (
    available.some(
      (group) =>
        !group.items.some(
          (item) => item.enabled && selection.itemIds.includes(item.id),
        ),
    )
  )
    throw new ServiceItemCatalogError(
      "ITEM_CATALOG_SELECTION_EMPTY",
      "Select at least one article for each enabled item type.",
    );
}

export async function savePlatformItemGroup(
  db: Database,
  auth: AuthContext,
  groupId: string,
  data: z.infer<typeof saveCatalogGroupSchema>,
  meta?: AuthRequestMeta,
) {
  requireSuperAdmin(auth);
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(platformServiceItemGroups)
      .where(eq(platformServiceItemGroups.id, groupId))
      .for("update");
    if (!locked)
      throw new ServiceItemCatalogError(
        "ITEM_CATALOG_NOT_FOUND",
        "Item type was not found.",
        404,
      );
    if (locked.version !== data.version)
      throw new ServiceItemCatalogError(
        "ITEM_CATALOG_VERSION_CONFLICT",
        "The catalog has changed. Refresh before saving.",
        409,
      );
    const before = (await findPlatformItemCatalog(tx)).find(
      (group) => group.id === groupId,
    )!;
    const ownIds = new Set(before.items.map((item) => item.id));
    if (data.items.some((item) => item.id && !ownIds.has(item.id)))
      throw new ServiceItemCatalogError(
        "ITEM_CATALOG_ARTICLE_INVALID",
        "An article does not belong to this item type.",
      );
    const { items, version: _version, ...fields } = data;
    await tx
      .update(platformServiceItemGroups)
      .set({
        ...fields,
        version: sql`${platformServiceItemGroups.version} + 1`,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      })
      .where(eq(platformServiceItemGroups.id, groupId));
    // Missing articles are archived, never deleted: historical tickets keep their references.
    await tx
      .update(platformServiceArticles)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(platformServiceArticles.groupId, groupId));
    for (const item of items) {
      if (item.id)
        await tx
          .update(platformServiceArticles)
          .set({ ...item, updatedAt: new Date() })
          .where(eq(platformServiceArticles.id, item.id));
      else
        await tx
          .insert(platformServiceArticles)
          .values({ ...item, id: createId(), groupId });
    }
    const after = (await findPlatformItemCatalog(tx)).find(
      (group) => group.id === groupId,
    )!;
    await writeAuditLog(tx, {
      actorUserId: auth.userId,
      tenantId: null,
      eventCategory: "saas_platform",
      eventType: "service_item_catalog.updated",
      entityType: "service_item_group",
      entityId: groupId,
      before,
      after,
      ...meta,
    });
    return after;
  });
}

export async function saveTenantItemSelection(
  db: Database,
  auth: AuthContext,
  tenantId: string,
  selection: TenantItemCatalogSelection,
  version: number,
  meta?: AuthRequestMeta,
) {
  requireSuperAdmin(auth);
  return db.transaction(async (tx) => {
    const [settings] = await tx
      .select({
        id: tenantSettings.id,
        version: tenantSettings.version,
        serviceItemCatalog: tenantSettings.serviceItemCatalog,
      })
      .from(tenantSettings)
      .innerJoin(tenants, eq(tenantSettings.tenantId, tenants.id))
      .where(
        and(eq(tenantSettings.tenantId, tenantId), isNull(tenants.deletedAt)),
      )
      .for("update", { of: tenantSettings });
    if (!settings)
      throw new ServiceItemCatalogError(
        "TENANT_SETTINGS_NOT_FOUND",
        "Tenant settings were not found.",
        404,
      );
    if (settings.version !== version)
      throw new ServiceItemCatalogError(
        "ITEM_CATALOG_VERSION_CONFLICT",
        "The catalog has changed. Refresh before saving.",
        409,
      );
    validateCatalogSelection(await findPlatformItemCatalog(tx), selection);
    await persistTenantItemCatalog(tx, tenantId, selection, auth.userId);
    await writeAuditLog(tx, {
      actorUserId: auth.userId,
      tenantId,
      eventCategory: "saas_tenant",
      eventType: "tenant_item_catalog.updated",
      entityType: "tenant_settings",
      entityId: settings.id,
      before: settings.serviceItemCatalog,
      after: selection,
      ...meta,
    });
    return findTenantItemCatalog(tx, tenantId);
  });
}
