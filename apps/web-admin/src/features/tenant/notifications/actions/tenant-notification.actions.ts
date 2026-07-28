import type {
  MarkAllTenantNotificationsReadResult,
  TenantNotificationInboxItem,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export function markTenantNotificationRead(
  deliveryId: string,
): Promise<TenantNotificationInboxItem> {
  return webAdminApi.tenant.notifications.markInboxRead(deliveryId);
}

export function archiveTenantNotification(
  deliveryId: string,
): Promise<TenantNotificationInboxItem> {
  return webAdminApi.tenant.notifications.archiveInbox(deliveryId);
}

export function markAllTenantNotificationsRead(): Promise<MarkAllTenantNotificationsReadResult> {
  return webAdminApi.tenant.notifications.markAllInboxRead();
}
