import { IntakeCustomerLookup } from "@/features/new-intake";

type NewIntakePageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function NewIntakePage({
  searchParams,
}: NewIntakePageProps) {
  const { q } = await searchParams;
  return <IntakeCustomerLookup initialQuery={q} />;
}
