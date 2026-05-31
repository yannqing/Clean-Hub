import { webAdminApi } from "@/lib/api-client";

import type { TenantNotificationSettings } from "../types";

export async function getNotificationSettingsQuery(): Promise<TenantNotificationSettings> {
  return webAdminApi.tenant.notifications.getSettings();
}
