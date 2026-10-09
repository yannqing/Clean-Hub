import { getTenantDefaultCurrencyQuery } from "@/features/tenant/settings/queries";

import type { ApiRequestOptions } from "@cleanhub/api-client";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export type ProductCurrencyDataset = {
  defaultCurrency: string;
  availableCurrencies: string[];
};

export async function getProductCurrencyDatasetQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<ProductCurrencyDataset> {
  const defaultCurrency = await getTenantDefaultCurrencyQuery(options);

  return {
    defaultCurrency,
    availableCurrencies: [defaultCurrency],
  };
}
