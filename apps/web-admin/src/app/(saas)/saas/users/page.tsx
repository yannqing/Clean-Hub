import { PagePlaceholder } from "@/components/app-shell";

export default function SaasUsersPage() {
  return (
    <PagePlaceholder
      description="Manage internal SaaS operators and platform roles."
      items={["SaaS admin users", "Roles", "Access status", "Login audit"]}
      title="SaaS Users"
    />
  );
}
