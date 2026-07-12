import { webAdminApi } from "@/lib/api-client";

import type { WhatsAppCredentialsState } from "../types";

/**
 * Load the tenant's stored WhatsApp Business API credentials.
 *
 * The access token is NEVER returned by the API — only a masked preview. Use
 * {@link saveWhatsAppCredentialsAction} to write a new token.
 */
export async function getWhatsAppCredentialsQuery(): Promise<WhatsAppCredentialsState> {
  return webAdminApi.tenant.notifications.getWhatsAppCredentials();
}
