import {
  prices,
  serviceCategories,
  services,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import type { PosCatalogQuery, PosCatalogService } from "./catalog.types.js";

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
    eq(serviceCategories.status, "active"),
    isNull(serviceCategories.deletedAt),
    eq(prices.tenantId, input.tenantId),
    eq(prices.status, "active"),
    isNull(prices.deletedAt),
  ];

  if (input.businessLine) {
    filters.push(eq(services.businessLine, input.businessLine));
  }
  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${services.name} ilike ${query} escape '\\'`,
        sql`${serviceCategories.name} ilike ${query} escape '\\'`,
      )!,
    );
  }

  return db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      labelRule: services.labelRule,
      amount: prices.amount,
      currency: prices.currency,
    })
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(serviceCategories.id, services.categoryId),
        eq(serviceCategories.tenantId, services.tenantId),
      ),
    )
    .innerJoin(
      prices,
      and(
        eq(prices.serviceId, services.id),
        eq(prices.tenantId, services.tenantId),
      ),
    )
    .where(and(...filters))
    .orderBy(
      asc(serviceCategories.sortOrder),
      asc(services.displayOrder),
      asc(services.name),
      asc(services.id),
    )
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
      categoryName: serviceCategories.name,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      labelRule: services.labelRule,
      amount: prices.amount,
      currency: prices.currency,
    })
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(serviceCategories.id, services.categoryId),
        eq(serviceCategories.tenantId, services.tenantId),
        eq(serviceCategories.status, "active"),
        isNull(serviceCategories.deletedAt),
      ),
    )
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
