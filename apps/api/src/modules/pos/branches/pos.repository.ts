import { and, eq, isNull } from "drizzle-orm";

import { type Database, tenants, tenantSettings } from "@cleanhub/db";

export async function findPosMerchantName(
  db: Database,
  tenantId: string,
): Promise<string | null> {
  const rows = await db
    .select({ merchantName: tenants.name })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  return rows[0]?.merchantName ?? null;
}

export async function findPosBranding(db: Database, tenantId: string) {
  const [row] = await db
    .select({
      posDisplayName: tenantSettings.posDisplayName,
      posLogoObjectKey: tenantSettings.posLogoObjectKey,
    })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  return row;
}
