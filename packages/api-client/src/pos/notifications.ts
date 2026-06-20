import type { ApiClient } from "../types";
import type {
  MarkAllPosNotificationsReadResult,
  MarkPosNotificationReadRequest,
  PosNotification,
  PosNotificationListQuery,
  PosNotificationListResponse,
} from "./notifications.types";

export function createPosNotificationsApi(client: ApiClient) {
  return {
    list: (query?: PosNotificationListQuery) =>
      client.get<PosNotificationListResponse>("/pos/notifications", { query }),
    markRead: (
      notificationId: string,
      input: MarkPosNotificationReadRequest,
    ) =>
      client.patch<PosNotification>(
        `/pos/notifications/${notificationId}`,
        input,
      ),
    markAllRead: () =>
      client.patch<MarkAllPosNotificationsReadResult>(
        "/pos/notifications/read-all",
        {},
      ),
  };
}
