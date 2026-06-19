import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import { headers } from "next/headers";

/**
 * Build request options that forward the incoming browser cookies to the API.
 *
 * Server components run on the server, so fetch() does NOT carry the browser's
 * auth cookies automatically. Every POS server-side query/action must pass
 * these options to `posApi.*` so /pos/* endpoints receive the auth cookies.
 */
export async function getPosServerApiRequestOptions(): Promise<
  Omit<ApiRequestOptions, "method" | "body">
> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");

  return {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  };
}
