import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";

type TenantSettingsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export type ProductCurrencyDataset = {
  defaultCurrency: string;
  availableCurrencies: string[];
};

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export async function getProductCurrencyDatasetQuery(
  options: TenantSettingsRequestOptions = {},
): Promise<ProductCurrencyDataset> {
  const settings = await webAdminApi.tenant.settings.get(options);
  const defaultCurrency = settings.defaultCurrency.trim().toUpperCase();

  if (!CURRENCY_CODE_PATTERN.test(defaultCurrency)) {
    throw new Error("Tenant default currency is invalid.");
  }

  const supportedCurrencies = Intl.supportedValuesOf("currency")
    .map((currency) => currency.toUpperCase())
    .filter((currency) => CURRENCY_CODE_PATTERN.test(currency))
    .sort((left, right) => left.localeCompare(right));

  return {
    defaultCurrency,
    availableCurrencies: [
      defaultCurrency,
      ...supportedCurrencies.filter((currency) => currency !== defaultCurrency),
    ],
  };
}
