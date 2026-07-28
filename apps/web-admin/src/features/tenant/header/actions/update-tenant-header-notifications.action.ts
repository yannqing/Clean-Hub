import type {
  MarkAllTenantNotificationsReadResult,
  TenantNotificationInboxItem,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export function markTenantHeaderNotificationReadAction(
  deliveryId: string,
): Promise<TenantNotificationInboxItem> {
  return webAdminApi.tenant.notifications.markInboxRead(deliveryId);
}

export function markAllTenantHeaderNotificationsReadAction(): Promise<MarkAllTenantNotificationsReadResult> {
  return webAdminApi.tenant.notifications.markAllInboxRead();
}

