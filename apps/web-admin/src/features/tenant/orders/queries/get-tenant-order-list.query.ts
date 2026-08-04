import type {
  TenantOrderListQuery,
  TenantOrderListResponse,
  TenantOrderSummary,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

const TENANT_ORDER_DATASET_CHUNK_SIZE = 100;

type TenantOrderDatasetQuery = Omit<
  TenantOrderListQuery,
  "limit" | "offset" | "q"
>;

export async function getTenantOrderListQuery(
  query: TenantOrderListQuery,
): Promise<TenantOrderListResponse> {
  return webAdminApi.tenant.orders.list(query);
}

export async function getTenantOrderDatasetQuery(
  query: TenantOrderDatasetQuery,
  signal?: AbortSignal,
): Promise<TenantOrderSummary[]> {
  const orders: TenantOrderSummary[] = [];
  let offset = 0;
  let total = 0;

  do {
    const result = await webAdminApi.tenant.orders.list(
      {
        ...query,
        limit: TENANT_ORDER_DATASET_CHUNK_SIZE,
        offset,
      },
      { signal },
    );

    orders.push(...result.data);
    total = result.total;
    offset += result.data.length;

    if (result.data.length === 0) {
      break;
    }
  } while (offset < total);

  return orders;
}
