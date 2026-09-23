import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  products,
  productSkus,
  services,
  taxRates,
  type Database,
} from "@cleanhub/db";

/**
 * The rate each catalogue item is sold at, or null where the item carries no
 * rate of its own and so falls back to the tenant default.
 *
 * Joined on (tenant_id, tax_rate_id) like the foreign key itself, so a rate
 * from another tenant can never be read even if an id were somehow shared.
 */
export type CatalogTaxRates = {
  byServiceId: Map<string, string | null>;
  byProductSkuId: Map<string, string | null>;
  byProductId: Map<string, string | null>;
};

export async function resolveCatalogTaxRates(
  db: Database,
  input: {
    tenantId: string;
    serviceIds?: readonly (string | null | undefined)[];
    productSkuIds?: readonly (string | null | undefined)[];
    productIds?: readonly (string | null | undefined)[];
  },
): Promise<CatalogTaxRates> {
  const unique = (values?: readonly (string | null | undefined)[]) => [
    ...new Set((values ?? []).filter((value): value is string => Boolean(value))),
  ];
  const serviceIds = unique(input.serviceIds);
  const productSkuIds = unique(input.productSkuIds);
  const productIds = unique(input.productIds);

  const [serviceRows, skuRows, productRows] = await Promise.all([
    serviceIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: services.id, rate: taxRates.rate })
          .from(services)
          .leftJoin(
            taxRates,
            and(
              eq(taxRates.tenantId, services.tenantId),
              eq(taxRates.id, services.taxRateId),
              isNull(taxRates.deletedAt),
            ),
          )
          .where(and(eq(services.tenantId, input.tenantId), inArray(services.id, serviceIds))),
    productSkuIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: productSkus.id, rate: taxRates.rate })
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
          .where(
            and(eq(productSkus.tenantId, input.tenantId), inArray(productSkus.id, productSkuIds)),
          ),
    productIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: products.id, rate: taxRates.rate })
          .from(products)
          .leftJoin(
            taxRates,
            and(
              eq(taxRates.tenantId, products.tenantId),
              eq(taxRates.id, products.taxRateId),
              isNull(taxRates.deletedAt),
            ),
          )
          .where(and(eq(products.tenantId, input.tenantId), inArray(products.id, productIds))),
  ]);

  return {
    byServiceId: new Map(serviceRows.map((row) => [row.id, row.rate ?? null])),
    byProductSkuId: new Map(skuRows.map((row) => [row.id, row.rate ?? null])),
    byProductId: new Map(productRows.map((row) => [row.id, row.rate ?? null])),
  };
}

/** The line's own rate if it has one, otherwise the tenant default. */
export function effectiveLineTaxRate(
  rates: CatalogTaxRates,
  line: {
    serviceId?: string | null;
    productSkuId?: string | null;
    productId?: string | null;
  },
  defaultRate: string,
): string {
  const own =
    (line.serviceId ? rates.byServiceId.get(line.serviceId) : undefined) ??
    (line.productSkuId ? rates.byProductSkuId.get(line.productSkuId) : undefined) ??
    (line.productId ? rates.byProductId.get(line.productId) : undefined);
  return own ?? defaultRate;
}
