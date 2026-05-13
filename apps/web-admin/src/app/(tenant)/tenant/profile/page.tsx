import { PagePlaceholder } from "@/components/app-shell";

export default function TenantProfilePage() {
  return (
    <PagePlaceholder
      description="Personal profile, tenant identity, branch access, language preference, and account security."
      items={["Profile", "Branch access", "Security", "Preferences"]}
      title="Personal Center"
    />
  );
}
