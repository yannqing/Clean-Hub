import { webAdminApi } from "@/lib/api-client";

import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationLogListQuery,
  NotificationLogListResult,
} from "../types";

export type NotificationLogQuery = {
  limit?: number;
  offset?: number;
  /** Status to filter by; omit to include all statuses. */
  status?: NotificationDeliveryStatus;
  /** Channel to filter by; omit to include all channels. */
  channel?: NotificationChannel;
};

/**
 * Load a page of delivery attempts for the tenant's notification send log.
 *
 * Target endpoint: `GET /tenant/notification-logs`. The api-client method
 * currently returns an empty result set until the backend route exists.
 */
export async function getNotificationLogsQuery(
  query?: NotificationLogQuery,
): Promise<NotificationLogListResult> {
  return webAdminApi.tenant.notifications.listLogs(toApiQuery(query));
}

function toApiQuery(
  query?: NotificationLogQuery,
): NotificationLogListQuery | undefined {
  if (!query) {
    return undefined;
  }

  const apiQuery: NotificationLogListQuery = {
    limit: query.limit,
    offset: query.offset,
  };

  if (query.status) {
    apiQuery.status = query.status;
  }

  if (query.channel) {
    apiQuery.channel = query.channel;
  }

  return apiQuery;
}
