import type {
  PosOrderListQuery,
  PosOrderListResponse,
  PosOrderSummary,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

const TENANT_ORDER_DATASET_CHUNK_SIZE = 100;

type TenantOrderDatasetQuery = Omit<
  PosOrderListQuery,
  "limit" | "offset" | "q"
>;

export async function getTenantOrderListQuery(
  query: PosOrderListQuery,
): Promise<PosOrderListResponse> {
  return webAdminApi.pos.orders.list(query);
}

export async function getTenantOrderDatasetQuery(
  query: TenantOrderDatasetQuery,
  signal?: AbortSignal,
): Promise<PosOrderSummary[]> {
  const orders: PosOrderSummary[] = [];
  let offset = 0;
  let total = 0;

  do {
    const result = await webAdminApi.pos.orders.list(
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
