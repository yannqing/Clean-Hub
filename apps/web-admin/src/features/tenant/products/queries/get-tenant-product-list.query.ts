import type {
  TenantProductListQuery,
  TenantProductListResponse,
  TenantProductSummary,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

const TENANT_PRODUCT_DATASET_CHUNK_SIZE = 100;

type TenantProductDatasetQuery = Omit<
  TenantProductListQuery,
  "limit" | "offset"
>;

export async function getTenantProductListQuery(
  query: TenantProductListQuery,
): Promise<TenantProductListResponse> {
  return webAdminApi.tenant.products.list(query);
}

export async function getTenantProductDatasetQuery(
  query: TenantProductDatasetQuery,
  signal?: AbortSignal,
): Promise<TenantProductSummary[]> {
  const products: TenantProductSummary[] = [];
  const seenProductIds = new Set<string>();
  let offset = 0;
  let total = 0;

  do {
    const result = await webAdminApi.tenant.products.list(
      {
        ...query,
        limit: TENANT_PRODUCT_DATASET_CHUNK_SIZE,
        offset,
      },
      { signal },
    );

    for (const product of result.data) {
      if (!seenProductIds.has(product.id)) {
        products.push(product);
        seenProductIds.add(product.id);
      }
    }

    total = result.total;
    offset += result.data.length;

    if (result.data.length === 0) {
      break;
    }
  } while (offset < total);

  return products;
}
