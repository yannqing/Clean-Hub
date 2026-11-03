import {
  and,
  asc,
  eq,
  getTableColumns,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import {
  serviceCategories,
  tenantFeatureFlags,
  type Database,
} from "@cleanhub/db";

import type {
  ServiceCategoryListInput,
  ServiceCategorySummary,
} from "./service-categories.types.js";

function toServiceCategorySummary(
  row: typeof serviceCategories.$inferSelect,
): ServiceCategorySummary {
  return {
    id: row.id,
    name: row.name,
    businessLine: row.businessLine,
    description: row.description,
    sortOrder: row.sortOrder,
    status: row.status,
  };
}

export async function findServiceCategories(
  db: Database,
  input: ServiceCategoryListInput & { tenantId: string },
): Promise<ServiceCategorySummary[]> {
  const filters: SQL[] = [
    eq(serviceCategories.tenantId, input.tenantId),
    isNull(serviceCategories.deletedAt),
    or(
      and(
        eq(serviceCategories.businessLine, "laundry"),
        eq(tenantFeatureFlags.laundryEnabled, true),
      ),
      and(
        eq(serviceCategories.businessLine, "car_wash"),
        eq(tenantFeatureFlags.carWashEnabled, true),
      ),
      and(
        eq(serviceCategories.businessLine, "retail"),
        eq(tenantFeatureFlags.retailProductsEnabled, true),
      ),
      and(
        eq(serviceCategories.businessLine, "delivery"),
        eq(tenantFeatureFlags.deliveryEnabled, true),
      ),
    )!,
  ];

  if (input.businessLine) {
    filters.push(eq(serviceCategories.businessLine, input.businessLine));
  }
  if (input.status) {
    filters.push(eq(serviceCategories.status, input.status));
  }

  const rows = await db
    .select({ ...getTableColumns(serviceCategories) })
    .from(serviceCategories)
    .innerJoin(
      tenantFeatureFlags,
      and(
        eq(tenantFeatureFlags.tenantId, input.tenantId),
        eq(tenantFeatureFlags.tenantId, serviceCategories.tenantId),
      ),
    )
    .where(and(...filters))
    .orderBy(
      asc(serviceCategories.sortOrder),
      asc(serviceCategories.name),
      asc(serviceCategories.id),
    )
    .limit(input.limit)
    .offset(input.offset);

  return rows.map(toServiceCategorySummary);
}

export async function findServiceCategoryById(
  db: Database,
  input: { tenantId: string; categoryId: string },
): Promise<ServiceCategorySummary | null> {
  const rows = await db
    .select()
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, input.categoryId),
        eq(serviceCategories.tenantId, input.tenantId),
        isNull(serviceCategories.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toServiceCategorySummary(rows[0]) : null;
}
