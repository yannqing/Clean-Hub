import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  branchProductSettings,
  branches,
  inventoryBalances,
  productCategories,
  productPrices,
  products,
  productSkus,
  type Database,
} from "@cleanhub/db";

import type {
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductOverview,
  TenantProductOverviewQuery,
  TenantProductPriceRange,
  TenantProductRepositoryScope,
  TenantProductSummary,
} from "./products.types.js";

type ProductFilterInput = {
  tenantId: string;
  status?: TenantProductListQuery["status"];
  createdAfter?: string;
  createdBefore?: string;
};

type ProductSkuRow = {
  id: string;
  productId: string;
  skuCode: string;
  barcode: string | null;
  status: "active" | "inactive";
  trackInventory: boolean;
  createdAt: Date;
};

type ProductPriceRow = {
  productSkuId: string;
  branchId: string | null;
  amount: string;
  currency: string;
};

function buildProductFilters(input: ProductFilterInput): SQL[] {
  const filters: SQL[] = [
    eq(products.tenantId, input.tenantId),
    isNull(products.deletedAt),
  ];

  if (input.status) {
    filters.push(eq(products.status, input.status));
  }
  if (input.createdAfter) {
    filters.push(gte(products.createdAt, new Date(input.createdAfter)));
  }
  if (input.createdBefore) {
    filters.push(lt(products.createdAt, new Date(input.createdBefore)));
  }

  return filters;
}

function orderProductSkus(rows: ProductSkuRow[]): ProductSkuRow[] {
  return [...rows].sort((left, right) => {
    const statusDifference =
      Number(left.status !== "active") - Number(right.status !== "active");

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const createdAtDifference =
      left.createdAt.getTime() - right.createdAt.getTime();

    return createdAtDifference || left.id.localeCompare(right.id);
  });
}

function sumQuantities(values: string[]): string {
  return values.reduce((total, value) => total + Number(value), 0).toFixed(3);
}

function buildPriceRanges(
  rows: Array<{ amount: string; currency: string }>,
): TenantProductPriceRange[] {
  const ranges = new Map<string, TenantProductPriceRange>();

  for (const row of rows) {
    const current = ranges.get(row.currency);

    if (!current) {
      ranges.set(row.currency, {
        currency: row.currency,
        minAmount: row.amount,
        maxAmount: row.amount,
      });
      continue;
    }

    if (Number(row.amount) < Number(current.minAmount)) {
      current.minAmount = row.amount;
    }
    if (Number(row.amount) > Number(current.maxAmount)) {
      current.maxAmount = row.amount;
    }
  }

  return [...ranges.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}

function resolveEffectiveSkuPrices(
  rows: ProductPriceRow[],
  branchIds: string[],
): Array<{ amount: string; currency: string }> {
  const pricesByCurrency = new Map<
    string,
    {
      defaultPrice?: ProductPriceRow;
      branchPrices: Map<string, ProductPriceRow>;
    }
  >();

  for (const row of rows) {
    const prices = pricesByCurrency.get(row.currency) ?? {
      branchPrices: new Map<string, ProductPriceRow>(),
    };

    if (row.branchId) {
      prices.branchPrices.set(row.branchId, row);
    } else {
      prices.defaultPrice = row;
    }

    pricesByCurrency.set(row.currency, prices);
  }

  const effectivePrices: Array<{ amount: string; currency: string }> = [];

  for (const [currency, prices] of pricesByCurrency) {
    if (branchIds.length === 0) {
      if (prices.defaultPrice) {
        effectivePrices.push({
          amount: prices.defaultPrice.amount,
          currency,
        });
      }
      continue;
    }

    for (const branchId of branchIds) {
      const price = prices.branchPrices.get(branchId) ?? prices.defaultPrice;

      if (price) {
        effectivePrices.push({
          amount: price.amount,
          currency,
        });
      }
    }
  }

  return effectivePrices;
}

async function findLowStockSkuIds(
  db: Database,
  input: TenantProductRepositoryScope &
    TenantProductOverviewQuery & { productIds?: string[] },
): Promise<Set<string>> {
  if (input.allowedBranchIds?.length === 0 || input.productIds?.length === 0) {
    return new Set();
  }

  const filters: SQL[] = [
    eq(products.tenantId, input.tenantId),
    eq(products.status, "active"),
    isNull(products.deletedAt),
    eq(productSkus.tenantId, input.tenantId),
    eq(productSkus.status, "active"),
    eq(productSkus.trackInventory, true),
    isNull(productSkus.deletedAt),
    eq(branchProductSettings.tenantId, input.tenantId),
    eq(branchProductSettings.isAvailable, true),
    sql`coalesce(${inventoryBalances.onHandQuantity}, 0) -
      coalesce(${inventoryBalances.reservedQuantity}, 0)
      <= ${branchProductSettings.reorderPoint}`,
  ];

  if (input.allowedBranchIds) {
    filters.push(
      inArray(branchProductSettings.branchId, input.allowedBranchIds),
    );
  }
  if (input.productIds) {
    filters.push(inArray(products.id, input.productIds));
  }
  if (input.createdAfter) {
    filters.push(gte(products.createdAt, new Date(input.createdAfter)));
  }
  if (input.createdBefore) {
    filters.push(lt(products.createdAt, new Date(input.createdBefore)));
  }

  const rows = await db
    .selectDistinct({ productSkuId: productSkus.id })
    .from(branchProductSettings)
    .innerJoin(
      productSkus,
      and(
        eq(productSkus.tenantId, branchProductSettings.tenantId),
        eq(productSkus.id, branchProductSettings.productSkuId),
      ),
    )
    .innerJoin(
      products,
      and(
        eq(products.tenantId, productSkus.tenantId),
        eq(products.id, productSkus.productId),
      ),
    )
    .leftJoin(
      inventoryBalances,
      and(
        eq(inventoryBalances.tenantId, branchProductSettings.tenantId),
        eq(inventoryBalances.branchId, branchProductSettings.branchId),
        eq(inventoryBalances.productSkuId, branchProductSettings.productSkuId),
      ),
    )
    .where(and(...filters));

  return new Set(rows.map((row) => row.productSkuId));
}

export async function findTenantProducts(
  db: Database,
  input: TenantProductListQuery & TenantProductRepositoryScope,
): Promise<TenantProductListResponse> {
  const filters = buildProductFilters(input);
  const [productRows, countRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        version: products.version,
      })
      .from(products)
      .leftJoin(
        productCategories,
        and(
          eq(productCategories.tenantId, products.tenantId),
          eq(productCategories.id, products.categoryId),
          isNull(productCategories.deletedAt),
        ),
      )
      .where(and(...filters))
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...filters)),
  ]);

  const total = countRows[0]?.count ?? 0;

  if (productRows.length === 0) {
    return { data: [], total };
  }

  const productIds = productRows.map((product) => product.id);
  const skuRows: ProductSkuRow[] = await db
    .select({
      id: productSkus.id,
      productId: productSkus.productId,
      skuCode: productSkus.skuCode,
      barcode: productSkus.barcode,
      status: productSkus.status,
      trackInventory: productSkus.trackInventory,
      createdAt: productSkus.createdAt,
    })
    .from(productSkus)
    .where(
      and(
        eq(productSkus.tenantId, input.tenantId),
        inArray(productSkus.productId, productIds),
        isNull(productSkus.deletedAt),
      ),
    );
  const skuIds = skuRows.map((sku) => sku.id);

  const [branchRows, priceRows, stockRows, lowStockSkuIds] = await Promise.all([
    input.allowedBranchIds?.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.tenantId, input.tenantId),
              eq(branches.status, "active"),
              isNull(branches.deletedAt),
              ...(input.allowedBranchIds
                ? [inArray(branches.id, input.allowedBranchIds)]
                : []),
            ),
          ),
    skuIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            productSkuId: productPrices.productSkuId,
            branchId: productPrices.branchId,
            amount: productPrices.amount,
            currency: productPrices.currency,
          })
          .from(productPrices)
          .where(
            and(
              eq(productPrices.tenantId, input.tenantId),
              inArray(productPrices.productSkuId, skuIds),
              eq(productPrices.status, "active"),
              isNull(productPrices.deletedAt),
              ...(input.allowedBranchIds
                ? [
                    input.allowedBranchIds.length === 0
                      ? isNull(productPrices.branchId)
                      : or(
                          isNull(productPrices.branchId),
                          inArray(
                            productPrices.branchId,
                            input.allowedBranchIds,
                          ),
                        )!,
                  ]
                : []),
            ),
          ),
    skuIds.length === 0 || input.allowedBranchIds?.length === 0
      ? Promise.resolve([])
      : db
          .select({
            productSkuId: inventoryBalances.productSkuId,
            onHandQuantity: sql<string>`coalesce(sum(${inventoryBalances.onHandQuantity}), 0)::text`,
            reservedQuantity: sql<string>`coalesce(sum(${inventoryBalances.reservedQuantity}), 0)::text`,
          })
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.tenantId, input.tenantId),
              inArray(inventoryBalances.productSkuId, skuIds),
              ...(input.allowedBranchIds
                ? [inArray(inventoryBalances.branchId, input.allowedBranchIds)]
                : []),
            ),
          )
          .groupBy(inventoryBalances.productSkuId),
    findLowStockSkuIds(db, {
      tenantId: input.tenantId,
      allowedBranchIds: input.allowedBranchIds,
      productIds,
    }),
  ]);

  const skusByProduct = new Map<string, ProductSkuRow[]>();
  const productIdBySkuId = new Map<string, string>();

  for (const sku of skuRows) {
    productIdBySkuId.set(sku.id, sku.productId);
    const productSkusForProduct = skusByProduct.get(sku.productId) ?? [];
    productSkusForProduct.push(sku);
    skusByProduct.set(sku.productId, productSkusForProduct);
  }

  const pricesByProduct = new Map<
    string,
    Array<{ amount: string; currency: string }>
  >();
  const pricesBySku = new Map<string, ProductPriceRow[]>();

  for (const price of priceRows) {
    const skuPrices = pricesBySku.get(price.productSkuId) ?? [];
    skuPrices.push(price);
    pricesBySku.set(price.productSkuId, skuPrices);
  }

  const effectiveBranchIds = branchRows.map((branch) => branch.id);

  for (const sku of skuRows) {
    const productId = productIdBySkuId.get(sku.id);

    if (!productId) {
      continue;
    }

    const productPricesForProduct = pricesByProduct.get(productId) ?? [];
    productPricesForProduct.push(
      ...resolveEffectiveSkuPrices(
        pricesBySku.get(sku.id) ?? [],
        effectiveBranchIds,
      ),
    );
    pricesByProduct.set(productId, productPricesForProduct);
  }

  const stockBySku = new Map(
    stockRows.map((row) => [
      row.productSkuId,
      {
        onHandQuantity: row.onHandQuantity,
        reservedQuantity: row.reservedQuantity,
      },
    ]),
  );

  const data: TenantProductSummary[] = productRows.map((product) => {
    const skus = orderProductSkus(skusByProduct.get(product.id) ?? []);
    const primarySku = skus[0] ?? null;

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      status: product.status,
      skuCount: skus.length,
      activeSkuCount: skus.filter((sku) => sku.status === "active").length,
      trackedSkuCount: skus.filter((sku) => sku.trackInventory).length,
      primarySkuCode: primarySku?.skuCode ?? null,
      primaryBarcode: primarySku?.barcode ?? null,
      skuCodes: skus.map((sku) => sku.skuCode),
      barcodes: skus
        .map((sku) => sku.barcode)
        .filter((barcode): barcode is string => barcode !== null),
      priceRanges: buildPriceRanges(pricesByProduct.get(product.id) ?? []),
      onHandQuantity: sumQuantities(
        skus.map((sku) => stockBySku.get(sku.id)?.onHandQuantity ?? "0"),
      ),
      reservedQuantity: sumQuantities(
        skus.map((sku) => stockBySku.get(sku.id)?.reservedQuantity ?? "0"),
      ),
      lowStockSkuCount: skus.filter((sku) => lowStockSkuIds.has(sku.id)).length,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      version: product.version,
    };
  });

  return { data, total };
}

export async function findTenantProductOverview(
  db: Database,
  input: TenantProductOverviewQuery & TenantProductRepositoryScope,
): Promise<TenantProductOverview> {
  const productFilters = buildProductFilters(input);
  const [countRows, lowStockSkuIds] = await Promise.all([
    db
      .select({
        productCount: sql<number>`count(distinct ${products.id})::int`,
        activeProductCount: sql<number>`count(distinct ${products.id}) filter (where ${products.status} = 'active')::int`,
        skuCount: sql<number>`count(distinct ${productSkus.id})::int`,
      })
      .from(products)
      .leftJoin(
        productSkus,
        and(
          eq(productSkus.tenantId, products.tenantId),
          eq(productSkus.productId, products.id),
          isNull(productSkus.deletedAt),
        ),
      )
      .where(and(...productFilters)),
    findLowStockSkuIds(db, input),
  ]);
  const counts = countRows[0];

  return {
    productCount: counts?.productCount ?? 0,
    activeProductCount: counts?.activeProductCount ?? 0,
    skuCount: counts?.skuCount ?? 0,
    lowStockSkuCount: lowStockSkuIds.size,
  };
}
