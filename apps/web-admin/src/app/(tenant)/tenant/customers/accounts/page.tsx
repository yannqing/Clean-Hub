import { TenantCustomerAccountsView } from "@/features/tenant/customers";

type TenantCustomerAccountsPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function TenantCustomerAccountsPage({
  searchParams,
}: TenantCustomerAccountsPageProps) {
  const query = (await searchParams)?.q;

  return (
    <TenantCustomerAccountsView
      initialSearchQuery={
        Array.isArray(query) ? (query[0] ?? "") : (query ?? "")
      }
    />
  );
}
