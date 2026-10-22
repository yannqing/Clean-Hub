import { TenantCustomersView } from "@/features/tenant/customers";

type TenantCustomersPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function TenantCustomersPage({
  searchParams,
}: TenantCustomersPageProps) {
  const query = (await searchParams)?.q;

  return (
    <TenantCustomersView
      initialSearchQuery={
        Array.isArray(query) ? (query[0] ?? "") : (query ?? "")
      }
    />
  );
}
