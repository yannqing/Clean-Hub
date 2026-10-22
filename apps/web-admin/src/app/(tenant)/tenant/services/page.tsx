import { ServiceCatalogView } from "@/features/tenant/services";

type ServicesPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function ServicesPage({
  searchParams,
}: ServicesPageProps) {
  const query = (await searchParams)?.q;

  return (
    <ServiceCatalogView
      initialSearchQuery={
        Array.isArray(query) ? (query[0] ?? "") : (query ?? "")
      }
    />
  );
}
