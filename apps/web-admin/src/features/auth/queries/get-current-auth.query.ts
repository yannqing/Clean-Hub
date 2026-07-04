import type { ApiRequestOptions, AuthContext } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

type AuthRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

/**
 * Fetch the current user's auth context (GET /auth/me).
 *
 * This is the single "throw on failure" entry point for getting the current
 * user/permissions across web-admin. Use it when a missing session should fail
 * the calling flow (most client components rely on `Promise.allSettled` and
 * surface the error themselves).
 *
 * Server usage: pass `requestOptions` to forward the inbound request's cookies
 * when calling the API from a Server Component / Server Action.
 * Client usage: omit `requestOptions` to use the browser's cookies.
 *
 * For the "return null instead of throwing" variant, use `getAuthSessionQuery`.
 */
export async function getCurrentAuthQuery(
  options: AuthRequestOptions = {},
): Promise<AuthContext> {
  return webAdminApi.auth.me(options);
}
