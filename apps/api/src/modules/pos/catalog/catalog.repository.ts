import {
  branches,
  branchProductSettings,
  inventoryBalances,
  mediaObjects,
  prices,
  productCategories,
  productPrices,
  productMedia,
  products,
  productSkus,
  serviceBranchSettings,
  serviceCategories,
  serviceMedia,
  services,
  taxRates,
  type Database,
} from "@cleanhub/db";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type {
  PosCatalogProductRecord,
  PosCatalogQuery,
  PosCatalogServiceRecord,
  PosCatalogMediaRecord,
} from "./catalog.types.js";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

async function findPosProductMedia(
  db: Database,
  input: { tenantId: string; productIds: string[] },
): Promise<Map<string, PosCatalogMediaRecord[]>> {
  if (input.productIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      productId: productMedia.productId,
      id: productMedia.id,
      objectKey: mediaObjects.objectKey,
      isPrimary: productMedia.isPrimary,
      sortOrder: productMedia.sortOrder,
    })
    .from(productMedia)
    .innerJoin(
      mediaObjects,
      and(
        eq(mediaObjects.tenantId, productMedia.tenantId),
        eq(mediaObjects.id, productMedia.mediaObjectId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .where(
      and(
        eq(productMedia.tenantId, input.tenantId),
        inArray(productMedia.productId, input.productIds),
        isNull(productMedia.productSkuId),
        isNull(productMedia.deletedAt),
      ),
    )
    .orderBy(
      desc(productMedia.isPrimary),
      asc(productMedia.sortOrder),
      asc(productMedia.id),
    );
  const mediaByProduct = new Map<string, PosCatalogMediaRecord[]>();
  for (const row of rows) {
    const media = mediaByProduct.get(row.productId) ?? [];
    media.push({
      id: row.id,
      objectKey: row.objectKey,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
    });
    mediaByProduct.set(row.productId, media);
  }
  return mediaByProduct;
}

async function findPosServiceMedia(
  db: Database,
  input: { tenantId: string; serviceIds: string[] },
): Promise<Map<string, PosCatalogMediaRecord[]>> {
  if (input.serviceIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      serviceId: serviceMedia.serviceId,
      id: serviceMedia.id,
      objectKey: mediaObjects.objectKey,
      isPrimary: serviceMedia.isPrimary,
      sortOrder: serviceMedia.sortOrder,
    })
    .from(serviceMedia)
    .innerJoin(
      mediaObjects,
      and(
        eq(mediaObjects.tenantId, serviceMedia.tenantId),
        eq(mediaObjects.id, serviceMedia.mediaObjectId),
        eq(mediaObjects.status, "committed"),
        isNull(mediaObjects.deletedAt),
      ),
    )
    .where(
      and(
        eq(serviceMedia.tenantId, input.tenantId),
        inArray(serviceMedia.serviceId, input.serviceIds),
        isNull(serviceMedia.deletedAt),
      ),
    )
    .orderBy(
      desc(serviceMedia.isPrimary),
      asc(serviceMedia.sortOrder),
      asc(serviceMedia.id),
    );
  const mediaByService = new Map<string, PosCatalogMediaRecord[]>();
  for (const row of rows) {
    const media = mediaByService.get(row.serviceId) ?? [];
    media.push({
      id: row.id,
      objectKey: row.objectKey,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
    });
    mediaByService.set(row.serviceId, media);
  }
  return mediaByService;
}

export async function findPosCatalogServices(
  db: Database,
  input: PosCatalogQuery & { tenantId: string },
): Promise<PosCatalogServiceRecord[]> {
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
      shortName: services.shortName,
      description: services.description,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      labelRule: services.labelRule,
      applicableItemTypes: services.applicableItemTypes,
      turnaroundMinutes: input.branchId
        ? sql<
            number | null
          >`coalesce(${serviceBranchSettings.turnaroundMinutesOverride}, ${services.turnaroundMinutes})`
        : services.turnaroundMinutes,
      amount: input.branchId
        ? sql<string>`coalesce(${serviceBranchSettings.priceOverrideAmount}, ${prices.amount})`
        : prices.amount,
      currency: prices.currency,
      // The service's own rate; null means the tenant default applies.
      taxRate: taxRates.rate,
    })
    .from(services)
    .leftJoin(
      taxRates,
      and(
        eq(taxRates.tenantId, services.tenantId),
        eq(taxRates.id, services.taxRateId),
        isNull(taxRates.deletedAt),
      ),
    )
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

  const rows = await (input.includeAll ? query : query.limit(input.limit));
  const mediaByService = await findPosServiceMedia(db, {
    tenantId: input.tenantId,
    serviceIds: rows.map((row) => row.id),
  });
  return rows.map((row) => ({
    ...row,
    media: mediaByService.get(row.id) ?? [],
  }));
}

export async function findPosCatalogServiceById(
  db: Database,
  input: { tenantId: string; branchId: string; serviceId: string },
): Promise<PosCatalogServiceRecord | null> {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      shortName: services.shortName,
      description: services.description,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      businessLine: services.businessLine,
      pricingUnit: services.pricingUnit,
      labelRule: services.labelRule,
      applicableItemTypes: services.applicableItemTypes,
      turnaroundMinutes: sql<
        number | null
      >`coalesce(${serviceBranchSettings.turnaroundMinutesOverride}, ${services.turnaroundMinutes})`,
      amount: sql<string>`coalesce(${serviceBranchSettings.priceOverrideAmount}, ${prices.amount})`,
      currency: prices.currency,
      // The service's own rate; null means the tenant default applies.
      taxRate: taxRates.rate,
    })
    .from(services)
    .leftJoin(
      taxRates,
      and(
        eq(taxRates.tenantId, services.tenantId),
        eq(taxRates.id, services.taxRateId),
        isNull(taxRates.deletedAt),
      ),
    )
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

  const service = rows[0];
  if (!service) {
    return null;
  }
  const mediaByService = await findPosServiceMedia(db, {
    tenantId: input.tenantId,
    serviceIds: [service.id],
  });
  return { ...service, media: mediaByService.get(service.id) ?? [] };
}

export async function findPosCatalogProducts(
  db: Database,
  input: PosCatalogQuery & { tenantId: string; branchId: string },
): Promise<PosCatalogProductRecord[]> {
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
      brand: products.brand,
      description: products.description,
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
      taxRate: taxRates.rate,
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
      taxRates,
      and(
        eq(taxRates.tenantId, products.tenantId),
        eq(taxRates.id, products.taxRateId),
        isNull(taxRates.deletedAt),
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

  const rows = await (input.includeAll ? query : query.limit(input.limit * 2));

  const seenSkuIds = new Set<string>();
  const catalog: Array<Omit<PosCatalogProductRecord, "media">> = [];
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
      brand: row.brand,
      description: row.description,
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
      taxRate: row.taxRate,
    });
    if (!input.includeAll && catalog.length >= input.limit) {
      break;
    }
  }
  const mediaByProduct = await findPosProductMedia(db, {
    tenantId: input.tenantId,
    productIds: [...new Set(catalog.map((product) => product.productId))],
  });
  return catalog.map((product) => ({
    ...product,
    media: mediaByProduct.get(product.productId) ?? [],
  }));
}

export async function findPosCatalogProductBySkuId(
  db: Database,
  input: { tenantId: string; branchId: string; productSkuId: string },
): Promise<PosCatalogProductRecord | null> {
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
