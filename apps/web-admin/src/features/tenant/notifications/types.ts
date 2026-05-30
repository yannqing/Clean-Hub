export type NotificationLanguage = "en" | "fr" | "zh-CN";
export type NotificationChannel = "whatsapp" | "sms" | "email";
export type NotificationEvent =
  | "order.created"
  | "order.ready"
  | "order.overdue_pickup"
  | "delivery.updated";

export type NotificationChannelSettings = Record<NotificationChannel, boolean>;

export type NotificationTemplateSettings = Record<
  NotificationEvent,
  {
    enabled: boolean;
    templateKey: string;
  }
>;

export type NotificationSettingsFormValues = {
  defaultLanguage: NotificationLanguage;
  channels: NotificationChannelSettings;
  templates: NotificationTemplateSettings;
};

export type TenantNotificationSettings = NotificationSettingsFormValues & {
  id: string;
  tenantId: string;
  deliveryMode: "not_connected";
  updatedAt: string;
  updatedBy: string | null;
  version: number;
};
