import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import type { TenantSettings } from "../types";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantSettingsQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<TenantSettings> {
  return webAdminApi.http.get<TenantSettings>("/tenant/settings", options);
}
