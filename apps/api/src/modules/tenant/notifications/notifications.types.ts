import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type TenantNoticeType = "system" | "business";
export type TenantNoticePriority = "low" | "normal" | "high" | "critical";
export type TenantNoticeReadStatus = "unread" | "read" | "archived";
export type TenantNoticeSenderType =
  | "system"
  | "user"
  | "customer"
  | "scheduler";

export type TenantNotificationInboxItem = {
  id: string;
  notificationId: string;
  tenantId: string | null;
  noticeType: TenantNoticeType;
  readStatus: TenantNoticeReadStatus;
  priority: TenantNoticePriority;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: string | null;
  senderType: TenantNoticeSenderType;
  senderId: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantNotificationListQuery = {
  noticeType?: TenantNoticeType;
  readStatus?: TenantNoticeReadStatus;
  priority?: TenantNoticePriority;
  relatedType?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type TenantNotificationListResponse = {
  data: TenantNotificationInboxItem[];
  total: number;
};

export type TenantNotificationOverview = {
  unreadCount: number;
  urgentUnreadCount: number;
  businessCount: number;
  systemCount: number;
};

export type TenantNotificationListInput = {
  tenantId: string;
  userId: string;
  query: TenantNotificationListQuery;
};

export type MarkTenantNotificationReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  deliveryId: string;
};

export type ArchiveTenantNotificationInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  deliveryId: string;
};

export type MarkAllTenantNotificationsReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
};
