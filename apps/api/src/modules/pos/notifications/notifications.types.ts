/**
 * POS notifications — DTOs.
 *
 * In-app alerts surfaced to the cashier terminal: order-ready pings, ticket
 * status changes, low-cash warnings, manager broadcast. Scaffold only.
 */
import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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

export type MarkPosNotificationReadRequest = {
  read: boolean;
};

export type PosNotificationListInput = {
  authContext: AuthContext;
  query: PosNotificationListQuery;
};

export type MarkPosNotificationReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  notificationId: string;
  data: MarkPosNotificationReadRequest;
};

export type MarkAllPosNotificationsReadInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
};
