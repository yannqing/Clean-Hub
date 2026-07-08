export const SUPPORTED_NOTIFICATION_LOCALES = ["fr", "en", "zh-CN"] as const;

export type NotificationLocale = (typeof SUPPORTED_NOTIFICATION_LOCALES)[number];

export type NotificationTriggerEvent =
  | "order.created"
  | "order.completed"
  | "appointment.accepted"
  | "appointment.rejected"
  | "refund.approved"
  | "refund.rejected"
  | "ticket.overdue"
  | "delivery.status_changed";

export type NotificationChannel = "email";

export type NotificationRecipientType =
  | "role"
  | "user"
  | "customer"
  | "branch_all"
  | "tenant_all";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationEvent = {
  name: NotificationTriggerEvent;
  tenantId: string;
  branchId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  locale?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
};

export type NotificationConfigRecord = {
  id: string;
  tenantId: string | null;
  templateId: string;
  templateCode: string;
  configName: string;
  noticeType: "system" | "business";
  triggerEvent: string | null;
  channel: NotificationChannel;
  recipientType: NotificationRecipientType;
  recipientRole: string | null;
  recipientUserId: string | null;
  frequencyLimit: number | null;
  frequencyWindowMinutes: number | null;
};

export type NotificationTemplateRecord = {
  id: string;
  tenantId: string | null;
  templateCode: string;
  templateName: string;
  noticeType: "system" | "business";
  locale: string;
  titleTemplate: string;
  contentTemplate: string;
};

export type NotificationRecord = {
  id: string;
  tenantId: string;
  scope: "pos" | "saas" | "tenant" | "mobile" | "desktop";
  noticeType: "system" | "business";
  configId: string | null;
  templateId: string | null;
  relatedType: string | null;
  relatedId: string | null;
  title: string;
  content: string;
  locale: string;
  payload: Record<string, unknown> | null;
  priority: NotificationPriority;
  idempotencyKey: string | null;
  createdAt: Date;
};

export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "cancelled";

export type NotificationDeliveryRecord = {
  id: string;
  tenantId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipientType: NotificationRecipientType;
  recipientId: string | null;
  status: NotificationDeliveryStatus;
  priority: NotificationPriority;
  scheduledAt: Date | null;
  sentAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  externalId: string | null;
  failedReason: string | null;
  createdAt: Date;
};

export type EmailDeliveryWorkItem = {
  delivery: NotificationDeliveryRecord;
  notification: NotificationRecord;
  config: Pick<
    NotificationConfigRecord,
    "id" | "triggerEvent" | "frequencyLimit" | "frequencyWindowMinutes"
  > | null;
};

export type NotificationEnqueueResult = {
  notification: NotificationRecord;
  delivery: NotificationDeliveryRecord | null;
  idempotent: boolean;
};

export type NotificationPublishResult = {
  matched: number;
  enqueued: number;
  skipped: number;
  idempotent: number;
};

export type NotificationDeliveryRunResult = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type OverdueTicketEventSource = {
  ticketId: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  ticketNo: string | null;
  expectedPickupAt: Date | null;
  customerName: string;
};
