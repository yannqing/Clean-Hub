import { and, eq, isNull } from "drizzle-orm";

import { type Database, tenants } from "@cleanhub/db";

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
