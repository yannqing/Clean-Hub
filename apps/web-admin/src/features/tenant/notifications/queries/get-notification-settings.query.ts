import { webAdminApi } from "@/lib/api-client";

import type { TenantNotificationSettings } from "../types";

export async function getNotificationSettingsQuery(): Promise<TenantNotificationSettings> {
  return webAdminApi.http.get<TenantNotificationSettings>(
    "/tenant/notification-settings",
  );
}
