import { getTenantDefaultCurrencyQuery } from "@/features/tenant/settings/queries";

import type { ApiRequestOptions } from "@cleanhub/api-client";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getServiceDefaultCurrencyQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<string> {
  return getTenantDefaultCurrencyQuery(options);
}
