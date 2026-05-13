import { PagePlaceholder } from "@/components/app-shell";

export default function TenantHomePage() {
  return (
    <PagePlaceholder
      description="Tenant back office for branches, users, service catalog, pricing, hardware, and reports."
      items={["Branches", "Tenant users", "Services", "Prices", "Hardware", "Reports"]}
      title="Tenant Admin"
    />
  );
}
