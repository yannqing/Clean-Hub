import type {
  ApiRequestOptions,
  TenantNotificationInboxOverview,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function getTenantHeaderNotificationOverviewQuery(
  options?: RequestOptions,
): Promise<TenantNotificationInboxOverview> {
  return webAdminApi.tenant.notifications.getInboxOverview(options);
}

