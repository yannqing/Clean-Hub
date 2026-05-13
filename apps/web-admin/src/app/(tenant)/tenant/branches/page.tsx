import { PagePlaceholder } from "@/components/app-shell";

export default function BranchesPage() {
  return (
    <PagePlaceholder
      description="Manage tenant branch profiles, operating status, addresses, and store-level settings."
      items={["Branch list", "Branch profile", "Operating status", "Store settings"]}
      title="Branches"
    />
  );
}
