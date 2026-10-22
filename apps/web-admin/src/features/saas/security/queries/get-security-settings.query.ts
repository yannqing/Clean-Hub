import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { SecuritySettings } from "../types";

type SecuritySettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body"
>;

/**
 * Fetch the SaaS security settings (GET /saas/security/settings).
 *
 * Server usage: pass `requestOptions` to forward the inbound request's cookies
 * when calling the API from a Server Component / Server Action.
 * Client usage: omit `requestOptions` to use the browser's cookies.
 */
export async function getSecuritySettingsQuery(
  options: SecuritySettingsRequestOptions = {},
): Promise<SecuritySettings> {
  return webAdminApi.saas.securitySettings.get(options);
}
