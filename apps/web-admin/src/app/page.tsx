import { PagePlaceholder } from "@/components/app-shell";

export default function WebAdminHome() {
  return (
    <PagePlaceholder
      description="Entry point for CleanHub administration. Use /saas for platform administration and /tenant for tenant back-office operations."
      items={["SaaS Admin", "Tenant Admin", "Auth", "API Health"]}
      title="CleanHub Web Admin"
    />
  );
}
