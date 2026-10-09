import type { PosNotificationInboxItem } from "@cleanhub/api-client";
import {
  addCalendarDays,
  getDateOnlyInTimeZone,
} from "@cleanhub/domain/timezone";

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 50;

export const NOTIFICATION_FILTER_KEYS = {
  q: "q",
  noticeType: "type",
  readStatus: "status",
  priority: "priority",
  relatedType: "related",
} as const;








export function formatNotificationDateTime(
  value: string | null,
  locale = "zh-CN",
  timeZone = "UTC",
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

export function getNotificationDateGroup(
  notification: PosNotificationInboxItem,
  timeZone = "UTC",
  now = new Date(),
): "today" | "yesterday" | "older" {
  const value = notification.sentAt ?? notification.createdAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "older";
  }

  const today = getDateOnlyInTimeZone(now, timeZone);
  const yesterday = addCalendarDays(today, -1);
  const notificationDate = getDateOnlyInTimeZone(date, timeZone);

  if (notificationDate === today) {
    return "today";
  }
  if (notificationDate === yesterday) {
    return "yesterday";
  }
  return "older";
}
