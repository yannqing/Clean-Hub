export type PosNotificationType =
  | "order_ready"
  | "ticket_updated"
  | "low_cash"
  | "manager_broadcast"
  | "system";

export type PosNotificationPriority = "low" | "normal" | "high";

export type PosNotification = {
  id: string;
  type: PosNotificationType;
  priority: PosNotificationPriority;
  title: string;
  body: string;
  read: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
};

export type PosNotificationListQuery = {
  type?: PosNotificationType;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

export type PosNotificationListResponse = {
  data: PosNotification[];
};

export type MarkPosNotificationReadRequest = {
  read: boolean;
};

export type MarkAllPosNotificationsReadResult = {
  updated: number;
};
