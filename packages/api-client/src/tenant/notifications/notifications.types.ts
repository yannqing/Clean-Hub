export type TenantNotificationInboxNoticeType = "system" | "business";
export type TenantNotificationInboxPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";
export type TenantNotificationInboxReadStatus = "unread" | "read" | "archived";
export type TenantNotificationInboxSenderType =
  | "system"
  | "user"
  | "customer"
  | "scheduler";

export type TenantNotificationInboxItem = {
  id: string;
  notificationId: string;
  tenantId: string | null;
  noticeType: TenantNotificationInboxNoticeType;
  readStatus: TenantNotificationInboxReadStatus;
  priority: TenantNotificationInboxPriority;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: string | null;
  senderType: TenantNotificationInboxSenderType;
  senderId: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantNotificationInboxListQuery = {
  noticeType?: TenantNotificationInboxNoticeType;
  readStatus?: TenantNotificationInboxReadStatus;
  priority?: TenantNotificationInboxPriority;
  relatedType?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type TenantNotificationInboxListResponse = {
  data: TenantNotificationInboxItem[];
  total: number;
};

export type TenantNotificationInboxOverview = {
  unreadCount: number;
  urgentUnreadCount: number;
  businessCount: number;
  systemCount: number;
};

export type MarkAllTenantNotificationsReadResult = {
  updated: number;
};

export type TenantNotificationInboxErrorCode =
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_ARCHIVED"
  | "VALIDATION_ERROR";
