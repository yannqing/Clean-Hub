import type {
  ApiRequestOptions,
  TenantOrderDetail,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type OrderDetailRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantOrderDetailQuery(
  orderId: string,
  options: OrderDetailRequestOptions = {},
): Promise<TenantOrderDetail> {
  return webAdminApi.tenant.orders.get(orderId, options);
}
