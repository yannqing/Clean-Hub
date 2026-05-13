import { PagePlaceholder } from "@/components/app-shell";

export default function SaasPlatformSettingsPage() {
  return (
    <PagePlaceholder
      description="Platform-level configuration for tenant limits, support access, and default operating rules."
      items={["Tenant limits", "Support access", "Default rules", "Compliance"]}
      title="Platform Settings"
    />
  );
}
