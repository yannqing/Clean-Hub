import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import { headers } from "next/headers";

export async function getSaasServerApiRequestOptions(): Promise<
  Omit<ApiRequestOptions, "method" | "body">
> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");

  return {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
    skipAuthRefresh: true,
  };
}
