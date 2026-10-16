import type {
  ApiRequestOptions,
  TenantNotificationInboxListQuery,
  TenantNotificationInboxListResponse,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function getTenantHeaderNotificationsQuery(
  query?: TenantNotificationInboxListQuery,
  options?: RequestOptions,
): Promise<TenantNotificationInboxListResponse> {
  return webAdminApi.tenant.notifications.listInbox(query, options);
}

