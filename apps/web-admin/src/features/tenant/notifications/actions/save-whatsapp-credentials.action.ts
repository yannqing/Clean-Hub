import { webAdminApi } from "@/lib/api-client";

import type {
  SaveWhatsAppCredentialsResult,
  WhatsAppCredentialsFormValues,
} from "../types";
import { validateWhatsAppCredentials } from "../validators";

/**
 * Validate and persist the tenant's WhatsApp Business API credentials.
 *
 * The access token is submitted in full; the API never returns it. On success
 * the action returns the post-save credential state (with the token masked).
 */
export async function saveWhatsAppCredentialsAction(
  input: WhatsAppCredentialsFormValues,
): Promise<SaveWhatsAppCredentialsResult> {
  const validation = validateWhatsAppCredentials(input);

  if (!validation.ok) {
    return validation;
  }

  const data = await webAdminApi.tenant.notifications.saveWhatsAppCredentials(
    validation.data,
  );

  return { ok: true, data };
}
