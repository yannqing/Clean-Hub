import type {
  NotificationChannel,
  NotificationEvent,
  NotificationLanguage,
  NotificationSettingsFormValues,
} from "./types";

export const notificationLanguageOptions: {
  label: string;
  value: NotificationLanguage;
}[] = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "Simplified Chinese", value: "zh-CN" },
];

export const notificationChannelOptions: {
  description: string;
  label: string;
  value: NotificationChannel;
}[] = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    description: "Customer updates through a future WhatsApp integration.",
  },
  {
    value: "sms",
    label: "SMS",
    description: "Short operational updates through a future SMS provider.",
  },
  {
    value: "email",
    label: "Email",
    description: "Optional email updates when a provider is connected.",
  },
];

export const notificationEventOptions: {
  label: string;
  value: NotificationEvent;
}[] = [
  { value: "order.created", label: "Order created" },
  { value: "order.ready", label: "Order ready" },
  { value: "order.overdue_pickup", label: "Overdue pickup" },
  { value: "delivery.updated", label: "Delivery updated" },
];

export const emptyNotificationSettingsForm: NotificationSettingsFormValues = {
  defaultLanguage: "en",
  channels: {
    whatsapp: true,
    sms: true,
    email: false,
  },
  templates: {
    "order.created": {
      enabled: true,
      templateKey: "order.created",
    },
    "order.ready": {
      enabled: true,
      templateKey: "order.ready",
    },
    "order.overdue_pickup": {
      enabled: true,
      templateKey: "order.overdue_pickup",
    },
    "delivery.updated": {
      enabled: true,
      templateKey: "delivery.updated",
    },
  },
};
