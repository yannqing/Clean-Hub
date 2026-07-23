import { prices, services, type Database } from "@cleanhub/db";
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import type {
  PosCatalogQuery,
  PosCatalogService,
} from "./catalog.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function findPosCatalogServices(
  db: Database,
  input: PosCatalogQuery & { tenantId: string },
): Promise<PosCatalogService[]> {
  const filters: SQL[] = [
    eq(services.tenantId, input.tenantId),
    eq(services.status, "active"),
    isNull(services.deletedAt),
    eq(prices.tenantId, input.tenantId),
    eq(prices.status, "active"),
    isNull(prices.deletedAt),
  ];

  if (input.businessLine) {
    filters.push(eq(services.businessLine, input.businessLine));
  }
  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(sql`${services.name} ilike ${query} escape '\\'`);
  }

  return db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      amount: prices.amount,
      currency: prices.currency,
    })
    .from(services)
    .innerJoin(
      prices,
      and(
        eq(prices.serviceId, services.id),
        eq(prices.tenantId, services.tenantId),
      ),
    )
    .where(and(...filters))
    .orderBy(asc(services.businessLine), asc(services.name))
    .limit(input.limit);
}

export async function findPosCatalogServiceById(
  db: Database,
  input: { tenantId: string; serviceId: string },
): Promise<PosCatalogService | null> {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      amount: prices.amount,
      currency: prices.currency,
    })
    .from(services)
    .innerJoin(
      prices,
      and(
        eq(prices.serviceId, services.id),
        eq(prices.tenantId, services.tenantId),
        eq(prices.status, "active"),
        isNull(prices.deletedAt),
      ),
    )
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.tenantId, input.tenantId),
        eq(services.status, "active"),
        isNull(services.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
