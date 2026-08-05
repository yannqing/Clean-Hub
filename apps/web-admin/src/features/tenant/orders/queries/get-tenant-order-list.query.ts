import type {
  ApiRequestOptions,
  TenantOrderListQuery,
  TenantOrderListResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Pick<ApiRequestOptions, "signal">;
type TenantOrderExportQuery = Omit<TenantOrderListQuery, "limit" | "offset">;

const EXPORT_PAGE_SIZE = 100;

export async function getTenantOrderListQuery(
  query: TenantOrderListQuery,
  options?: RequestOptions,
): Promise<TenantOrderListResponse> {
  return webAdminApi.tenant.orders.list(query, options);
}

export async function getTenantOrderExportDatasetQuery(
  query: TenantOrderExportQuery,
  options?: RequestOptions,
): Promise<TenantOrderListResponse["data"]> {
  const orders: TenantOrderListResponse["data"] = [];
  let offset = 0;
  let total = 0;

  do {
    const result = await webAdminApi.tenant.orders.list(
      {
        ...query,
        limit: EXPORT_PAGE_SIZE,
        offset,
      },
      options,
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
