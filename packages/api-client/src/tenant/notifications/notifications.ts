import type { ApiClient } from "../../types";
import type {
  TenantNotificationSettings,
  UpdateTenantNotificationSettingsRequest,
} from "./notifications.types";

export function createTenantNotificationsApi(client: ApiClient) {
  return {
    getSettings: () =>
      client.get<TenantNotificationSettings>("/tenant/notification-settings"),
    updateSettings: (data: UpdateTenantNotificationSettingsRequest) =>
      client.patch<TenantNotificationSettings>(
        "/tenant/notification-settings",
        data,
      ),
  };
}
