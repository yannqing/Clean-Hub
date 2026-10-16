import { getPointOfSaleSettingsQuery } from "@/features/tenant/point-of-sale";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { PricingSettingsView } from "@/features/tenant/settings/components";
import { getTaxRatesQuery } from "@/features/tenant/tax-rates/queries";

export default async function TenantSettingsPricingPage() {
  const taxRates = await getTaxRatesQuery(await getTenantServerApiRequestOptions())
    .then((rates) => ({ rates, failed: false }))
    .catch(() => ({ rates: [], failed: true }));
  const result = await getPointOfSaleSettingsQuery()
    .then((settings) => ({ settings, error: undefined }))
    .catch((error: unknown) => ({
      settings: undefined,
      error:
        error instanceof Error ? error.message : "Tax settings failed to load.",
    }));

  return (
    <PricingSettingsView
      taxError={result.error}
      taxRates={taxRates.rates}
      taxRatesLoadFailed={taxRates.failed}
      taxSettings={result.settings}
    />
  );
}
