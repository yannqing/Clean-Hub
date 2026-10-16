import { IntakeCustomerLookup } from "@/features/new-intake";
import { getPosCatalogQuery } from "@/features/catalog/queries";

type NewIntakePageProps = {
  searchParams: Promise<{ q?: string; serviceId?: string }>;
};

export default async function NewIntakePage({
  searchParams,
}: NewIntakePageProps) {
  const { q, serviceId } = await searchParams;

  // Resolve the name so the clerk can see which service they are finding a
  // customer for. Best effort: the lookup still works without it.
  const serviceName = serviceId
    ? await getPosCatalogQuery()
        .then(
          (catalog) =>
            catalog.data.find((service) => service.id === serviceId)?.name,
        )
        .catch(() => undefined)
    : undefined;

  return (
    <IntakeCustomerLookup
      initialQuery={q}
      serviceId={serviceId}
      serviceName={serviceName}
    />
  );
}
