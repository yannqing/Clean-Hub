import { getPointOfSaleSettingsQuery } from "@/features/tenant/point-of-sale";
import { PricingSettingsView } from "@/features/tenant/settings/components";

export default async function TenantSettingsPricingPage() {
  const result = await getPointOfSaleSettingsQuery()
    .then((settings) => ({ settings, error: undefined }))
    .catch((error: unknown) => ({
      settings: undefined,
      error:
        error instanceof Error ? error.message : "Tax settings failed to load.",
    }));

  return (
    <PricingSettingsView taxError={result.error} taxSettings={result.settings} />
  );
}
