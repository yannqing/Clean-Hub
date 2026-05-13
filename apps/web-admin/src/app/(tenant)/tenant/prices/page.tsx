import { PagePlaceholder } from "@/components/app-shell";

export default function PricesPage() {
  return (
    <PagePlaceholder
      description="Manage price books, branch-specific pricing, and service pricing rules."
      items={["Price books", "Branch overrides", "Tax rules", "Effective dates"]}
      title="Prices"
    />
  );
}
