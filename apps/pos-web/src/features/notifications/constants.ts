import type {
  PosNoticePriority,
  PosNoticeReadStatus,
  PosNoticeRelatedType,
  PosNoticeType,
  PosNotificationInboxItem,
} from "@cleanhub/api-client";

export const NOTIFICATIONS_PAGE_TITLE = "通知中心";
export const DEFAULT_NOTIFICATION_PAGE_SIZE = 50;

export const NOTIFICATION_FILTER_KEYS = {
  q: "q",
  noticeType: "type",
  readStatus: "status",
  priority: "priority",
  relatedType: "related",
} as const;

export const NOTICE_TYPE_LABELS: Record<PosNoticeType, string> = {
  business: "业务",
  system: "系统",
};

export const NOTICE_TYPE_OPTIONS: ReadonlyArray<{
  value: PosNoticeType;
  label: string;
}> = [
  { value: "business", label: NOTICE_TYPE_LABELS.business },
  { value: "system", label: NOTICE_TYPE_LABELS.system },
];

export const NOTICE_READ_STATUS_LABELS: Record<PosNoticeReadStatus, string> = {
  unread: "未读",
  read: "已读",
  archived: "已归档",
};

export const NOTICE_READ_STATUS_OPTIONS: ReadonlyArray<{
  value: PosNoticeReadStatus;
  label: string;
}> = [
  { value: "unread", label: NOTICE_READ_STATUS_LABELS.unread },
  { value: "read", label: NOTICE_READ_STATUS_LABELS.read },
  { value: "archived", label: NOTICE_READ_STATUS_LABELS.archived },
];

export const NOTICE_PRIORITY_LABELS: Record<PosNoticePriority, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  critical: "紧急",
};

export const NOTICE_PRIORITY_OPTIONS: ReadonlyArray<{
  value: PosNoticePriority;
  label: string;
}> = [
  { value: "critical", label: NOTICE_PRIORITY_LABELS.critical },
  { value: "high", label: NOTICE_PRIORITY_LABELS.high },
  { value: "normal", label: NOTICE_PRIORITY_LABELS.normal },
  { value: "low", label: NOTICE_PRIORITY_LABELS.low },
];

export const NOTICE_RELATED_TYPE_LABELS: Record<PosNoticeRelatedType, string> = {
  order: "订单",
  ticket: "工单",
};

export const NOTICE_RELATED_TYPE_OPTIONS: ReadonlyArray<{
  value: PosNoticeRelatedType;
  label: string;
}> = [
  { value: "order", label: NOTICE_RELATED_TYPE_LABELS.order },
  { value: "ticket", label: NOTICE_RELATED_TYPE_LABELS.ticket },
];

export function formatNotificationDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function getNotificationDateGroup(
  notification: PosNotificationInboxItem,
): "today" | "yesterday" | "older" {
  const value = notification.sentAt ?? notification.createdAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "older";
  }

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  if (date >= todayStart) {
    return "today";
  }
  if (date >= yesterdayStart) {
    return "yesterday";
  }
  return "older";
}
