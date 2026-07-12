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

export type NotificationSettingsValue = {
  defaultLanguage: NotificationLanguage;
  channels: NotificationChannelSettings;
  templates: NotificationTemplateSettings;
};

/**
 * Delivery state for the tenant's notification setup.
 *
 * `"not_connected"` is the historical default (settings saved but no provider
 * wired up). `"connected"` is reserved for once a real WhatsApp/SMS adapter is
 * mounted behind the credential endpoints — the api-client already supports it
 * so tenant types don't have to change again later.
 */
export type NotificationDeliveryMode = "not_connected" | "connected";

export type TenantNotificationSettings = NotificationSettingsValue & {
  id: string;
  tenantId: string;
  deliveryMode: NotificationDeliveryMode;
  updatedAt: string;
  updatedBy: string | null;
  version: number;
};

export type UpdateTenantNotificationSettingsRequest =
  NotificationSettingsValue;

/* -------------------------------------------------------------------------- */
/* WhatsApp Business API credentials                                          */
/* -------------------------------------------------------------------------- */

/**
 * The writable shape — what the credential form submits. `accessToken` is the
 * full secret, sent only on save.
 */
export type WhatsAppCredentialsValue = {
  /**
   * Whether the backend has stored a usable credential set. `false` until a
   * real credential endpoint is wired up (currently always `false` — mock layer).
   */
  connected: boolean;
  /** WhatsApp Business Account ID (numeric, e.g. `1029384756102`). */
  wabaId: string;
  /** Phone Number ID the Meta Cloud API assigned to the sender number. */
  phoneNumberId: string;
  /**
   * Masked preview of the stored access token. The API must NEVER return the
   * full token; only the last 4 characters prefixed with `••••`. Empty when no
   * token is stored.
   */
  accessTokenMasked: string;
  /** Meta template namespace for pre-approved message templates. */
  templateNamespace: string;
};

/**
 * The save payload — `accessToken` is write-only (full token). All other fields
 * echo `WhatsAppCredentialsValue` so the form round-trips.
 */
export type SaveWhatsAppCredentialsRequest = {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  templateNamespace: string;
};

/* -------------------------------------------------------------------------- */
/* Notification log / sending history                                         */
/* -------------------------------------------------------------------------- */

export type NotificationDeliveryStatus = "pending" | "sent" | "failed";

export type NotificationLogItem = {
  id: string;
  /** Event that triggered the message, e.g. `order.created`. */
  event: NotificationEvent;
  /** Channel used for the delivery attempt. */
  channel: NotificationChannel;
  /** Recipient identifier — phone number for WhatsApp/SMS, email for email. */
  recipient: string;
  /** Delivery state at the time of the last attempt. */
  status: NotificationDeliveryStatus;
  /** Provider message id once accepted (nullable until sent). */
  externalId: string | null;
  /** Provider/driver error message on failure. */
  failedReason: string | null;
  /** ISO timestamp of the most recent attempt. */
  sentAt: string | null;
};

export type NotificationLogListQuery = {
  limit?: number;
  offset?: number;
  channel?: NotificationChannel;
  status?: NotificationDeliveryStatus;
};

export type NotificationLogListResult = {
  items: NotificationLogItem[];
  total: number;
};

/* -------------------------------------------------------------------------- */
/* Test send                                                                  */
/* -------------------------------------------------------------------------- */

export type SendTestMessageRequest = {
  channel: NotificationChannel;
  /** Recipient — phone number (E.164) for WhatsApp/SMS, email otherwise. */
  recipient: string;
  /** Optional event the test message mimics. */
  event?: NotificationEvent;
};

export type SendTestMessageResult = {
  ok: boolean;
  /** Provider message id on success. */
  messageId?: string;
  /** Human-readable error on failure. */
  error?: string;
};
