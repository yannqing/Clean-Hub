import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MarkAllPosNotificationsReadResult,
  PosNotificationInboxItem,
  PosNotificationListQuery,
  PosNotificationListResponse,
  PosNotificationOverview,
} from "./notifications.types";

const BASE = "/pos/notifications";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosNotificationsApi(client: ApiClient) {
  return {
    list: (query?: PosNotificationListQuery, options?: RequestOptions) =>
      client.get<PosNotificationListResponse>(BASE, { query, ...options }),
    overview: (options?: RequestOptions) =>
      client.get<PosNotificationOverview>(`${BASE}/overview`, options),
    markRead: (deliveryId: string, options?: RequestOptions) =>
      client.patch<PosNotificationInboxItem>(
        `${BASE}/${deliveryId}/read`,
        {},
        options,
      ),
    markAllRead: (options?: RequestOptions) =>
      client.patch<MarkAllPosNotificationsReadResult>(
        `${BASE}/read-all`,
        {},
        options,
      ),
    archive: (deliveryId: string, options?: RequestOptions) =>
      client.patch<PosNotificationInboxItem>(
        `${BASE}/${deliveryId}/archive`,
        {},
        options,
      ),
  };
}
