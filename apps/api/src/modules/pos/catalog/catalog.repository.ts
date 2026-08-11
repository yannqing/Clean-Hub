import {
  branches,
  branchProductSettings,
  inventoryBalances,
  prices,
  productCategories,
  productPrices,
  products,
  productSkus,
  serviceBranchSettings,
  serviceCategories,
  services,
  type Database,
} from "@cleanhub/db";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import type {
  PosCatalogProduct,
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
    eq(serviceCategories.status, "active"),
    isNull(serviceCategories.deletedAt),
    eq(prices.tenantId, input.tenantId),
    eq(prices.status, "active"),
    isNull(prices.deletedAt),
  ];

  if (input.businessLine) {
    filters.push(eq(services.businessLine, input.businessLine));
  }
  if (input.branchId) {
    filters.push(sql`(
      (${services.allBranches} = true and coalesce(${serviceBranchSettings.isAvailable}, true) = true)
      or (${services.allBranches} = false and ${serviceBranchSettings.isAvailable} = true)
    )`);
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

  const query = db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      labelRule: services.labelRule,
      turnaroundMinutes: input.branchId
        ? sql<number | null>`coalesce(${serviceBranchSettings.turnaroundMinutesOverride}, ${services.turnaroundMinutes})`
        : services.turnaroundMinutes,
      amount: input.branchId
        ? sql<string>`coalesce(${serviceBranchSettings.priceOverrideAmount}, ${prices.amount})`
        : prices.amount,
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
    .leftJoin(
      serviceBranchSettings,
      and(
        eq(serviceBranchSettings.tenantId, services.tenantId),
        eq(serviceBranchSettings.serviceId, services.id),
        input.branchId
          ? eq(serviceBranchSettings.branchId, input.branchId)
          : sql`false`,
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
    );

  return input.includeAll ? query : query.limit(input.limit);
}

export async function findPosCatalogServiceById(
  db: Database,
  input: { tenantId: string; branchId: string; serviceId: string },
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
      turnaroundMinutes: sql<number | null>`coalesce(${serviceBranchSettings.turnaroundMinutesOverride}, ${services.turnaroundMinutes})`,
      amount: sql<string>`coalesce(${serviceBranchSettings.priceOverrideAmount}, ${prices.amount})`,
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
    .leftJoin(
      serviceBranchSettings,
      and(
        eq(serviceBranchSettings.tenantId, services.tenantId),
        eq(serviceBranchSettings.serviceId, services.id),
        eq(serviceBranchSettings.branchId, input.branchId),
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
        sql`(
          (${services.allBranches} = true and coalesce(${serviceBranchSettings.isAvailable}, true) = true)
          or (${services.allBranches} = false and ${serviceBranchSettings.isAvailable} = true)
        )`,
        eq(services.status, "active"),
        isNull(services.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findPosCatalogProducts(
  db: Database,
  input: PosCatalogQuery & { tenantId: string; branchId: string },
): Promise<PosCatalogProduct[]> {
  const filters: SQL[] = [
    eq(products.tenantId, input.tenantId),
    eq(products.status, "active"),
    isNull(products.deletedAt),
    eq(productSkus.tenantId, input.tenantId),
    eq(productSkus.status, "active"),
    isNull(productSkus.deletedAt),
    eq(branchProductSettings.tenantId, input.tenantId),
    eq(branchProductSettings.branchId, input.branchId),
    eq(branchProductSettings.isAvailable, true),
    eq(branches.tenantId, input.tenantId),
    eq(branches.id, input.branchId),
    eq(branches.status, "active"),
    isNull(branches.deletedAt),
    eq(productPrices.tenantId, input.tenantId),
    eq(productPrices.status, "active"),
    isNull(productPrices.deletedAt),
    or(
      eq(productPrices.branchId, input.branchId),
      isNull(productPrices.branchId),
    )!,
    eq(productPrices.currency, branches.defaultCurrency),
  ];

  if (input.q) {
    const query = `%${escapeLikePattern(input.q)}%`;
    filters.push(
      or(
        sql`${products.name} ilike ${query} escape '\\'`,
        sql`${productCategories.name} ilike ${query} escape '\\'`,
        sql`${productSkus.id} ilike ${query} escape '\\'`,
        sql`${productSkus.skuCode} ilike ${query} escape '\\'`,
        sql`${productSkus.barcode} ilike ${query} escape '\\'`,
        sql`${productSkus.variantName} ilike ${query} escape '\\'`,
      )!,
    );
  }

  const query = db
    .select({
      productId: products.id,
      productSkuId: productSkus.id,
      productPriceId: productPrices.id,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      sku: productSkus.skuCode,
      barcode: productSkus.barcode,
      variantName: productSkus.variantName,
      unitOfMeasure: productSkus.unitOfMeasure,
      unitCostAmount: productSkus.referenceCostAmount,
      amount: productPrices.amount,
      currency: productPrices.currency,
      trackInventory: productSkus.trackInventory,
      onHandQuantity: inventoryBalances.onHandQuantity,
      reservedQuantity: inventoryBalances.reservedQuantity,
      allowNegativeStock: branchProductSettings.allowNegativeStock,
      allowOfflineSale: branchProductSettings.allowOfflineSale,
      offlineStockBuffer: branchProductSettings.offlineStockBuffer,
    })
    .from(productSkus)
    .innerJoin(
      products,
      and(
        eq(products.tenantId, productSkus.tenantId),
        eq(products.id, productSkus.productId),
      ),
    )
    .leftJoin(
      productCategories,
      and(
        eq(productCategories.tenantId, products.tenantId),
        eq(productCategories.id, products.categoryId),
        eq(productCategories.status, "active"),
        isNull(productCategories.deletedAt),
      ),
    )
    .innerJoin(
      branchProductSettings,
      and(
        eq(branchProductSettings.tenantId, productSkus.tenantId),
        eq(branchProductSettings.productSkuId, productSkus.id),
      ),
    )
    .innerJoin(
      branches,
      and(
        eq(branches.tenantId, branchProductSettings.tenantId),
        eq(branches.id, branchProductSettings.branchId),
      ),
    )
    .innerJoin(
      productPrices,
      and(
        eq(productPrices.tenantId, productSkus.tenantId),
        eq(productPrices.productSkuId, productSkus.id),
      ),
    )
    .leftJoin(
      inventoryBalances,
      and(
        eq(inventoryBalances.tenantId, productSkus.tenantId),
        eq(inventoryBalances.branchId, branchProductSettings.branchId),
        eq(inventoryBalances.productSkuId, productSkus.id),
      ),
    )
    .where(and(...filters))
    .orderBy(
      asc(products.name),
      asc(productSkus.variantName),
      asc(productSkus.id),
      sql`${productPrices.branchId} is null`,
    );

  const rows = await (input.includeAll
    ? query
    : query.limit(input.limit * 2));

  const seenSkuIds = new Set<string>();
  const catalog: PosCatalogProduct[] = [];
  for (const row of rows) {
    if (seenSkuIds.has(row.productSkuId)) {
      continue;
    }
    seenSkuIds.add(row.productSkuId);
    const availableQuantity = row.trackInventory
      ? (
          Number(row.onHandQuantity ?? 0) - Number(row.reservedQuantity ?? 0)
        ).toFixed(3)
      : null;
    catalog.push({
      id: row.productSkuId,
      productId: row.productId,
      productSkuId: row.productSkuId,
      productPriceId: row.productPriceId,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      sku: row.sku,
      barcode: row.barcode,
      variantName: row.variantName,
      unitOfMeasure: row.unitOfMeasure,
      unitCostAmount: row.unitCostAmount,
      amount: row.amount,
      currency: row.currency,
      trackInventory: row.trackInventory,
      availableQuantity,
      allowNegativeStock: row.allowNegativeStock,
      allowOfflineSale: row.allowOfflineSale,
      offlineStockBuffer: row.offlineStockBuffer,
    });
    if (!input.includeAll && catalog.length >= input.limit) {
      break;
    }
  }
  return catalog;
}

export async function findPosCatalogProductBySkuId(
  db: Database,
  input: { tenantId: string; branchId: string; productSkuId: string },
): Promise<PosCatalogProduct | null> {
  const products = await findPosCatalogProducts(db, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    q: input.productSkuId,
    limit: 2,
  });
  return (
    products.find((product) => product.productSkuId === input.productSkuId) ??
    null
  );
}
