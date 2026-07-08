import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEvent,
  NotificationLanguage,
} from "@cleanhub/api-client";

import type { NotificationSettingsFormValues } from "./types";

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

/* -------------------------------------------------------------------------- */
/* WhatsApp credential form                                                   */
/* -------------------------------------------------------------------------- */

export type WhatsAppCredentialFieldId =
  | "wabaId"
  | "phoneNumberId"
  | "accessToken"
  | "templateNamespace";

export type WhatsAppCredentialField = {
  id: WhatsAppCredentialFieldId;
  label: string;
  placeholder: string;
  /** Secret fields are masked on load and never echoed back from the API. */
  secret: boolean;
  required: boolean;
};

/**
 * Field metadata for the credentials form. Labels/placeholders live in the i18n
 * catalog (so this list only carries structural flags) — the view maps these
 * ids to localized strings.
 */
export const whatsappCredentialFields: WhatsAppCredentialField[] = [
  { id: "wabaId", label: "", placeholder: "", secret: false, required: true },
  {
    id: "phoneNumberId",
    label: "",
    placeholder: "",
    secret: false,
    required: true,
  },
  {
    id: "accessToken",
    label: "",
    placeholder: "",
    secret: true,
    required: true,
  },
  {
    id: "templateNamespace",
    label: "",
    placeholder: "",
    secret: false,
    required: false,
  },
];

export const emptyWhatsAppCredentialsForm = {
  wabaId: "",
  phoneNumberId: "",
  accessToken: "",
  templateNamespace: "",
} as const;

/* -------------------------------------------------------------------------- */
/* Template variable hints                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-event variables a tenant can interpolate into the matching WhatsApp /
 * provider template body. These are the stable variable names the backend
 * renderer will expose; they are surfaced in the UI as a hint so merchants
 * know what they can author against.
 */
export const templateVariableHints: Record<NotificationEvent, string[]> = {
  "order.created": [
    "{{customer_name}}",
    "{{order_code}}",
    "{{branch_name}}",
    "{{pickup_time}}",
  ],
  "order.ready": [
    "{{customer_name}}",
    "{{order_code}}",
    "{{branch_name}}",
    "{{ready_time}}",
  ],
  "order.overdue_pickup": [
    "{{customer_name}}",
    "{{order_code}}",
    "{{branch_name}}",
    "{{overdue_hours}}",
  ],
  "delivery.updated": [
    "{{customer_name}}",
    "{{order_code}}",
    "{{courier_name}}",
    "{{status}}",
  ],
};

/* -------------------------------------------------------------------------- */
/* Notification log                                                           */
/* -------------------------------------------------------------------------- */

export const notificationLogStatusOptions: {
  value: NotificationDeliveryStatus;
  label: string;
}[] = [
  { value: "pending", label: "" },
  { value: "sent", label: "" },
  { value: "failed", label: "" },
];

export const notificationLogChannelOptions: {
  value: NotificationChannel;
  label: string;
}[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];
