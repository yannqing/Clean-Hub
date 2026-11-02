import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import { headers } from "next/headers";
import { getWebAdminLocaleFromCookies } from "@/i18n/locale.server";

export async function getTenantServerApiRequestOptions(): Promise<
  Omit<ApiRequestOptions, "method" | "body">
> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");

  return {
    cache: "no-store",
    headers: {
      ...(cookie ? { cookie } : {}),
      "accept-language": await getWebAdminLocaleFromCookies(),
    },
  };
}
