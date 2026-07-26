import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getServiceDefaultCurrencyQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<string> {
  const settings = await webAdminApi.tenant.settings.get(options);
  const currency = settings.defaultCurrency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Tenant default currency is invalid.");
  }

  return currency;
}
