import { and, eq, isNull } from "drizzle-orm";

import {
  type Database,
  tenantFeatureFlags,
  tenants,
} from "@cleanhub/db";

import type { TenantOverview } from "./overview.types.js";

export async function findTenantOverviewBase(
  db: Database,
  tenantId: string,
): Promise<
  Pick<TenantOverview, "tenantId" | "tenantName" | "tenantStatus" | "featureFlags"> | null
> {
  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
      laundryEnabled: tenantFeatureFlags.laundryEnabled,
      carWashEnabled: tenantFeatureFlags.carWashEnabled,
      retailProductsEnabled: tenantFeatureFlags.retailProductsEnabled,
      deliveryEnabled: tenantFeatureFlags.deliveryEnabled,
      notificationsEnabled: tenantFeatureFlags.notificationsEnabled,
    })
    .from(tenants)
    .innerJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantStatus: row.tenantStatus,
    featureFlags: {
      laundryEnabled: row.laundryEnabled,
      carWashEnabled: row.carWashEnabled,
      retailProductsEnabled: row.retailProductsEnabled,
      deliveryEnabled: row.deliveryEnabled,
      notificationsEnabled: row.notificationsEnabled,
    },
  };
}
