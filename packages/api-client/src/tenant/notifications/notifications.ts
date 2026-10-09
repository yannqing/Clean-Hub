import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  MarkAllTenantNotificationsReadResult,
  TenantNotificationInboxItem,
  TenantNotificationInboxListQuery,
  TenantNotificationInboxListResponse,
  TenantNotificationInboxOverview,
} from "./notifications.types";

const TENANT_NOTIFICATION_INBOX_BASE = "/tenant/notifications";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantNotificationsApi(client: ApiClient) {
  return {
    listInbox: (
      query?: TenantNotificationInboxListQuery,
      options?: RequestOptions,
    ) =>
      client.get<TenantNotificationInboxListResponse>(
        TENANT_NOTIFICATION_INBOX_BASE,
        { query, ...options },
      ),
    getInboxOverview: (options?: RequestOptions) =>
      client.get<TenantNotificationInboxOverview>(
        `${TENANT_NOTIFICATION_INBOX_BASE}/overview`,
        options,
      ),
    markInboxRead: (deliveryId: string, options?: RequestOptions) =>
      client.patch<TenantNotificationInboxItem>(
        `${TENANT_NOTIFICATION_INBOX_BASE}/${deliveryId}/read`,
        {},
        options,
      ),
    markAllInboxRead: (options?: RequestOptions) =>
      client.patch<MarkAllTenantNotificationsReadResult>(
        `${TENANT_NOTIFICATION_INBOX_BASE}/read-all`,
        {},
        options,
      ),
    archiveInbox: (deliveryId: string, options?: RequestOptions) =>
      client.patch<TenantNotificationInboxItem>(
        `${TENANT_NOTIFICATION_INBOX_BASE}/${deliveryId}/archive`,
        {},
        options,
      ),
  };
}
