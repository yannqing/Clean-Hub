import { PagePlaceholder } from "@/components/app-shell";

export default function TenantSystemPreferencesPage() {
  return (
    <PagePlaceholder
      description="Tenant-level preferences for locale, currency, working rules, branch defaults, and operational policies."
      items={["Locale", "Currency", "Branch defaults", "Policies"]}
      title="Tenant Preferences"
    />
  );
}
