import {
  DEFAULT_POINT_OF_SALE_DATE_PRESET,
  PointOfSaleOverviewView,
  getPointOfSaleOverviewQuery,
  resolvePointOfSaleDatePreset,
  resolveSelectedPointOfSaleDatePreset,
  type PointOfSaleOverviewQuery,
} from "@/features/tenant/point-of-sale";

type PointOfSalePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function PointOfSalePage({
  searchParams,
}: PointOfSalePageProps) {
  const params = (await searchParams) ?? {};
  const requestedQuery: PointOfSaleOverviewQuery = {
    from: getStringParam(params, "from"),
    to: getStringParam(params, "to"),
    branchId: getStringParam(params, "branchId"),
    currency: getStringParam(params, "currency"),
  };
  const result = await getPointOfSaleOverviewQuery(requestedQuery)
    .then((summary) => ({ summary, error: undefined as string | undefined }))
    .catch((error: unknown) => ({
      summary: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Point-of-sale overview failed to load.",
    }));
  const fallbackRange = resolvePointOfSaleDatePreset(
    DEFAULT_POINT_OF_SALE_DATE_PRESET,
  );
  const query: PointOfSaleOverviewQuery = result.summary
    ? {
        from: result.summary.filters.from,
        to: result.summary.filters.to,
        branchId: result.summary.filters.branchId ?? undefined,
        currency: result.summary.currency,
      }
    : {
        ...requestedQuery,
        from: requestedQuery.from ?? fallbackRange.from,
        to: requestedQuery.to ?? fallbackRange.to,
      };
  const selectedPreset =
    !requestedQuery.from && !requestedQuery.to
      ? DEFAULT_POINT_OF_SALE_DATE_PRESET
      : resolveSelectedPointOfSaleDatePreset(
          query,
          new Date(),
          result.summary?.timezone ?? "UTC",
        );

  return (
    <PointOfSaleOverviewView
      error={result.error}
      query={query}
      selectedPreset={selectedPreset}
      summary={result.summary}
    />
  );
}
