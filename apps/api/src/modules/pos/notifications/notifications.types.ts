import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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

export type PosNotificationListInput = {
  tenantId: string;
  userId: string;
  query: PosNotificationListQuery;
};

export type PosNotificationDeliveryInput = {
  tenantId: string;
  recipientUserId: string;
  noticeType: PosNoticeType;
  title: string;
  content: string;
  priority?: PosNoticePriority;
  relatedType?: PosNoticeRelatedType;
  relatedId?: string | null;
  locale?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  senderType?: PosNoticeSenderType;
  senderId?: string | null;
  actorUserId?: string | null;
};

export type MarkPosNotificationReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  deliveryId: string;
};

export type ArchivePosNotificationInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  deliveryId: string;
};

export type MarkAllPosNotificationsReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
};
