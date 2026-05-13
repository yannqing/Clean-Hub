import { PagePlaceholder } from "@/components/app-shell";

export default function SaasTenantsPage() {
  return (
    <PagePlaceholder
      description="Manage tenant accounts, tenant status, subscriptions, and tenant-level settings."
      items={["Tenant list", "Tenant search", "Tenant status", "Tenant detail entry"]}
      title="Tenants"
    />
  );
}
