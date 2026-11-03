export type PosNoticeType = "system" | "business";
export type PosNoticePriority = "low" | "normal" | "high" | "critical";
export type PosNoticeReadStatus = "unread" | "read" | "archived";
export type PosNoticeRelatedType = "ticket" | "order";
export type PosNoticeSenderType = "system" | "user" | "customer" | "scheduler";

export type PosNotificationInboxItem = {
  id: string;
  notificationId: string;
  tenantId: string | null;
  noticeType: PosNoticeType;
  readStatus: PosNoticeReadStatus;
  priority: PosNoticePriority;
  title: string;
  content: string;
  relatedType: PosNoticeRelatedType | null;
  relatedId: string | null;
  senderType: PosNoticeSenderType;
  senderId: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type PosNotificationListQuery = {
  noticeType?: PosNoticeType;
  readStatus?: PosNoticeReadStatus;
  priority?: PosNoticePriority;
  relatedType?: PosNoticeRelatedType;
  q?: string;
  limit?: number;
  offset?: number;
};

export type PosNotificationListResponse = {
  data: PosNotificationInboxItem[];
  total: number;
};

export type PosNotificationOverview = {
  unreadCount: number;
  urgentUnreadCount: number;
  businessCount: number;
  systemCount: number;
};

export type MarkAllPosNotificationsReadResult = {
  updated: number;
};

export type PosNotificationErrorCode =
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_ARCHIVED"
  | "VALIDATION_ERROR";
