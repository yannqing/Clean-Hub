import type {
  NotificationSettingsValue,
  SaveWhatsAppCredentialsRequest,
  WhatsAppCredentialsValue,
} from "@cleanhub/api-client";

export type {
  NotificationChannel,
  NotificationChannelSettings,
  NotificationDeliveryStatus,
  NotificationEvent,
  NotificationLanguage,
  NotificationLogItem,
  NotificationLogListQuery,
  NotificationLogListResult,
  NotificationTemplateSettings,
  SaveWhatsAppCredentialsRequest,
  SendTestMessageRequest,
  SendTestMessageResult,
  TenantNotificationSettings,
  WhatsAppCredentialsValue,
} from "@cleanhub/api-client";

export type NotificationSettingsFormValues = NotificationSettingsValue;

/**
 * Form values for the WhatsApp credentials card. The access token is write-only
 * — it's typed `""` while editing (never loaded from the API) and submitted in
 * full via {@link SaveWhatsAppCredentialsRequest}.
 */
export type WhatsAppCredentialsFormValues = Omit<
  SaveWhatsAppCredentialsRequest,
  "accessToken"
> & {
  accessToken: string;
};

/** Shape returned when the credentials are first loaded for display. */
export type WhatsAppCredentialsState = WhatsAppCredentialsValue;

/** Discriminated result for the credential-save action. */
export type SaveWhatsAppCredentialsResult =
  | { ok: true; data: WhatsAppCredentialsValue }
  | {
      ok: false;
      errors: Partial<Record<keyof WhatsAppCredentialsFormValues, string>>;
      message: string;
    };

/** Discriminated result for credential-form validation (success carries the form values). */
export type WhatsAppCredentialsValidation =
  | { ok: true; data: WhatsAppCredentialsFormValues }
  | {
      ok: false;
      errors: Partial<Record<keyof WhatsAppCredentialsFormValues, string>>;
      message: string;
    };

/** Discriminated result for the test-send action. */
export type SendTestMessageActionResult =
  | { ok: true; data: import("@cleanhub/api-client").SendTestMessageResult }
  | { ok: false; message: string };
