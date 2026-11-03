import {
  PointOfSaleSettingsView,
  getPointOfSaleSettingsQuery,
} from "@/features/tenant/point-of-sale";

export default async function TenantSettingsPointOfSalePage() {
  const result = await getPointOfSaleSettingsQuery()
    .then((settings) => ({
      settings,
      error: undefined as string | undefined,
    }))
    .catch((error: unknown) => ({
      settings: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Point-of-sale settings failed to load.",
    }));

  return (
    <PointOfSaleSettingsView
      embedded
      error={result.error}
      initialSettings={result.settings}
    />
  );
}
