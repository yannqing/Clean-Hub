import type { AuthContext } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";
import type { ApiRequestOptions } from "@cleanhub/api-client";

type AuthSessionRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

/**
 * Fetch the current user's auth context (GET /auth/me).
 *
 * Server usage: pass `requestOptions` to forward the inbound request's cookies
 * when calling the API from a Server Component / Server Action.
 * Client usage: omit `requestOptions` to use the browser's cookies.
 *
 * Returns null when the session can't be resolved (unauthenticated or network
 * error) so callers can degrade gracefully instead of throwing.
 */
export async function getAuthSessionQuery(
  options: AuthSessionRequestOptions = {},
): Promise<AuthContext | null> {
  try {
    return await webAdminApi.auth.me(options);
  } catch {
    return null;
  }
}
