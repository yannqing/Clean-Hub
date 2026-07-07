import { webAdminApi } from "@/lib/api-client";

import type { SendTestMessageActionResult, SendTestMessageRequest } from "../types";

/**
 * Send a one-off test message to verify provider connectivity.
 *
 * Target endpoint: `POST /tenant/notifications/test-send`. The api-client
 * method currently always reports `{ ok: false, error: "WhatsApp provider not
 * connected" }` until a real adapter is mounted — callers should surface that
 * error to the user as the test result.
 */
export async function sendTestNotificationAction(
  input: SendTestMessageRequest,
): Promise<SendTestMessageActionResult> {
  try {
    const result = await webAdminApi.tenant.notifications.sendTestMessage(input);

    if (!result.ok) {
      return { ok: false, message: result.error ?? "Test message failed." };
    }

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Test message request failed.",
    };
  }
}
