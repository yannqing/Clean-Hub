import { PagePlaceholder } from "@/components/app-shell";

export default function NewTenantPage() {
  return (
    <PagePlaceholder
      description="Create a tenant shell with owner account, default branch, locale, and initial configuration."
      items={["Tenant profile", "Owner account", "Initial branch", "Activation state"]}
      title="New Tenant"
    />
  );
}
