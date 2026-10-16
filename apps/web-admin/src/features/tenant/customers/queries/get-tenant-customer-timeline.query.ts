import type {
  ApiRequestOptions,
  TenantCustomerTimelineQuery,
  TenantCustomerTimelineResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function getTenantCustomerTimelineQuery(
  customerId: string,
  query: TenantCustomerTimelineQuery = {},
  options: RequestOptions = {},
): Promise<TenantCustomerTimelineResponse> {
  return webAdminApi.tenant.customers.timeline(customerId, query, options);
}
