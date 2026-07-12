import type { ApiClient } from "../../types";
import type {
  NotificationLogListQuery,
  NotificationLogListResult,
  SaveWhatsAppCredentialsRequest,
  SendTestMessageRequest,
  SendTestMessageResult,
  TenantNotificationSettings,
  UpdateTenantNotificationSettingsRequest,
  WhatsAppCredentialsValue,
} from "./notifications.types";

/* -------------------------------------------------------------------------- */
/* Mock helpers — remove once the backend credential/log/test endpoints land. */
/* -------------------------------------------------------------------------- */

function maskAccessToken(token: string): string {
  if (!token) {
    return "";
  }

  // Mirror the masking the real backend will apply: only the last 4 chars are
  // visible. Tokens shorter than 4 chars are fully masked.
  const tail = token.slice(-4);
  return `••••${tail}`;
}

const MOCK_DISCONNECTED_CREDENTIALS: WhatsAppCredentialsValue = {
  connected: false,
  wabaId: "",
  phoneNumberId: "",
  accessTokenMasked: "",
  templateNamespace: "",
};

export function createTenantNotificationsApi(client: ApiClient) {
  return {
    getSettings: () =>
      client.get<TenantNotificationSettings>("/tenant/notification-settings"),
    updateSettings: (data: UpdateTenantNotificationSettingsRequest) =>
      client.patch<TenantNotificationSettings>(
        "/tenant/notification-settings",
        data,
      ),

    /**
     * Fetch the tenant's stored WhatsApp Business API credentials.
     *
     * Target endpoint: `GET /tenant/notification-credentials/whatsapp`
     *
     * MOCK: returns a disconnected credential set until the backend route and
     * credential-storage mechanism exist.
     */
    async getWhatsAppCredentials(): Promise<WhatsAppCredentialsValue> {
      // MOCK — wire to backend later: client.get("/tenant/notification-credentials/whatsapp")
      return { ...MOCK_DISCONNECTED_CREDENTIALS };
    },

    /**
     * Persist the tenant's WhatsApp credentials.
     *
     * Target endpoint: `PUT /tenant/notification-credentials/whatsapp`
     *
     * MOCK: echoes the saved values with the token masked and `connected: true`
     * so the form round-trips. A real implementation must encrypt the token
     * server-side and never return the plaintext.
     */
    async saveWhatsAppCredentials(
      data: SaveWhatsAppCredentialsRequest,
    ): Promise<WhatsAppCredentialsValue> {
      // MOCK — wire to backend later:
      //   client.put("/tenant/notification-credentials/whatsapp", data)
      void client;
      return {
        connected: true,
        wabaId: data.wabaId,
        phoneNumberId: data.phoneNumberId,
        accessTokenMasked: maskAccessToken(data.accessToken),
        templateNamespace: data.templateNamespace,
      };
    },

    /**
     * List delivery attempts for the tenant's notification log.
     *
     * Target endpoint: `GET /tenant/notification-logs`
     *
     * MOCK: returns an empty result set until the backend log endpoint and the
     * `notification_deliveries` reader exist.
     */
    async listLogs(
      query?: NotificationLogListQuery,
    ): Promise<NotificationLogListResult> {
      // MOCK — wire to backend later:
      //   client.get<NotificationLogListResult>("/tenant/notification-logs", { query })
      void client;
      void query;
      return { items: [], total: 0 };
    },

    /**
     * Send a one-off test message to verify provider connectivity.
     *
     * Target endpoint: `POST /tenant/notifications/test-send`
     *
     * MOCK: always reports failure with a "provider not connected" reason until
     * a real adapter is mounted.
     */
    async sendTestMessage(
      input: SendTestMessageRequest,
    ): Promise<SendTestMessageResult> {
      // MOCK — wire to backend later:
      //   client.post<SendTestMessageResult>("/tenant/notifications/test-send", input)
      void client;
      void input;
      return { ok: false, error: "WhatsApp provider not connected" };
    },
  };
}
