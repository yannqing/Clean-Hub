import {
  platformServiceArticles,
  platformServiceItemGroups,
  tenantSettings,
  tenants,
  type Database,
} from "@cleanhub/db";
import type {
  PlatformServiceItemGroup,
  TenantItemCatalogSelection,
  TenantServiceItemCatalog,
} from "@cleanhub/domain/service-item-catalog";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

export async function findPlatformItemCatalog(
  db: Database,
): Promise<PlatformServiceItemGroup[]> {
  const [groups, articles] = await Promise.all([
    db
      .select()
      .from(platformServiceItemGroups)
      .orderBy(
        asc(platformServiceItemGroups.sortOrder),
        asc(platformServiceItemGroups.id),
      ),
    db
      .select()
      .from(platformServiceArticles)
      .orderBy(
        asc(platformServiceArticles.sortOrder),
        asc(platformServiceArticles.id),
      ),
  ]);
  return groups.map((group) => ({
    ...group,
    items: articles.filter((item) => item.groupId === group.id),
  }));
}

export async function findTenantItemCatalog(
  db: Database,
  tenantId: string,
): Promise<TenantServiceItemCatalog & { version: number }> {
  const [settings] = await db
    .select({
      selection: tenantSettings.serviceItemCatalog,
      version: tenantSettings.version,
    })
    .from(tenantSettings)
    .innerJoin(tenants, eq(tenantSettings.tenantId, tenants.id))
    .where(
      and(eq(tenantSettings.tenantId, tenantId), isNull(tenants.deletedAt)),
    )
    .limit(1);
  return {
    groups: await findPlatformItemCatalog(db),
    selection: settings?.selection ?? null,
    version: settings?.version ?? 0,
  };
}

export async function persistTenantItemCatalog(
  db: Database,
  tenantId: string,
  selection: TenantItemCatalogSelection,
  userId: string,
) {
  await db
    .update(tenantSettings)
    .set({
      serviceItemCatalog: selection,
      version: sql`${tenantSettings.version} + 1`,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(tenantSettings.tenantId, tenantId));
}
