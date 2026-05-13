import { PagePlaceholder } from "@/components/app-shell";

export default function ReportsPage() {
  return (
    <PagePlaceholder
      description="Tenant reporting entry for sales, operations, branch performance, and audit views."
      items={["Sales", "Operations", "Branch performance", "Exports"]}
      title="Reports"
    />
  );
}
