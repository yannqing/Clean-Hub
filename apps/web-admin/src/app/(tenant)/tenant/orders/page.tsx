import { TenantOrdersView } from "@/features/tenant/orders";

type TenantOrdersPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function TenantOrdersPage({
  searchParams,
}: TenantOrdersPageProps) {
  const query = (await searchParams)?.q;

  return (
    <TenantOrdersView
      initialSearchQuery={
        Array.isArray(query) ? (query[0] ?? "") : (query ?? "")
      }
    />
  );
}
