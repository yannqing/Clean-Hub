import type { PosNotificationErrorCode } from "@cleanhub/api-client";

export type {
  MarkAllPosNotificationsReadResult,
  PosNoticePriority,
  PosNoticeReadStatus,
  PosNoticeRelatedType,
  PosNoticeType,
  PosNotificationErrorCode,
  PosNotificationInboxItem,
  PosNotificationListQuery,
  PosNotificationListResponse,
  PosNotificationOverview,
} from "@cleanhub/api-client";

export type NotificationActionResult<TPayload = unknown> = {
  ok: boolean;
  message: string;
  code?: PosNotificationErrorCode;
  status?: number;
  data?: TPayload;
};
