import type {
  ApiRequestOptions,
  TenantOrderTimelineQuery,
  TenantOrderTimelineResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type TimelineRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantOrderTimelineQuery(
  orderId: string,
  query: TenantOrderTimelineQuery = {},
  options: TimelineRequestOptions = {},
): Promise<TenantOrderTimelineResponse> {
  return webAdminApi.tenant.orders.timeline(orderId, query, options);
}
