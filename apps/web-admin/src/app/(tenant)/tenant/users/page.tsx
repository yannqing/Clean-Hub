import { PagePlaceholder } from "@/components/app-shell";

export default function TenantUsersPage() {
  return (
    <PagePlaceholder
      description="Manage tenant staff accounts, branch access, and tenant roles."
      items={["Staff list", "Roles", "Branch access", "Account status"]}
      title="Tenant Users"
    />
  );
}
