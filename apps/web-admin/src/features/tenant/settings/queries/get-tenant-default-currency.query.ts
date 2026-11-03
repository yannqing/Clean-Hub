import type { ApiRequestOptions } from "@cleanhub/api-client";

import { getTenantSettingsQuery } from "./get-tenant-settings.query";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export async function getTenantDefaultCurrencyQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<string> {
  const settings = await getTenantSettingsQuery(options);
  const currency = settings.defaultCurrency.trim().toUpperCase();

  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    throw new Error("Tenant default currency is invalid.");
  }

  return currency;
}
