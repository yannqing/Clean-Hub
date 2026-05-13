import { PagePlaceholder } from "@/components/app-shell";

export default function SaasLocalizationPage() {
  return (
    <PagePlaceholder
      description="Global language, currency, timezone, and regional defaults for platform-managed tenants."
      items={["Languages", "Currencies", "Timezones", "Regional formats"]}
      title="Localization"
    />
  );
}
