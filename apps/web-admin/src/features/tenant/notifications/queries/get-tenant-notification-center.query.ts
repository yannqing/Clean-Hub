import type {
  ApiRequestOptions,
  TenantNotificationInboxListQuery,
  TenantNotificationInboxListResponse,
  TenantNotificationInboxOverview,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function getTenantNotificationListQuery(
  query: TenantNotificationInboxListQuery,
  options?: RequestOptions,
): Promise<TenantNotificationInboxListResponse> {
  return webAdminApi.tenant.notifications.listInbox(query, options);
}

export function getTenantNotificationOverviewQuery(
  options?: RequestOptions,
): Promise<TenantNotificationInboxOverview> {
  return webAdminApi.tenant.notifications.getInboxOverview(options);
}
