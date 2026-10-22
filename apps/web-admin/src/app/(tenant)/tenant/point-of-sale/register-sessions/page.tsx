import {
  DEFAULT_POINT_OF_SALE_DATE_PRESET,
  RegisterSessionsView,
  getRegisterSessionsQuery,
  resolvePointOfSaleDatePreset,
  resolveSelectedPointOfSaleDatePreset,
  type PointOfSaleRegisterSessionQuery,
  type PointOfSaleShiftStatus,
} from "@/features/tenant/point-of-sale";

const PAGE_SIZE = 10;

type RegisterSessionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getOffset(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getStatus(
  value: string | undefined,
): PointOfSaleShiftStatus | undefined {
  return value === "open" || value === "on_break" || value === "closed"
    ? value
    : undefined;
}

export default async function RegisterSessionsPage({
  searchParams,
}: RegisterSessionsPageProps) {
  const params = (await searchParams) ?? {};
  const fallbackRange = resolvePointOfSaleDatePreset(
    DEFAULT_POINT_OF_SALE_DATE_PRESET,
  );
  const requestedQuery: PointOfSaleRegisterSessionQuery = {
    from: getStringParam(params, "from"),
    to: getStringParam(params, "to"),
    branchId: getStringParam(params, "branchId"),
    status: getStatus(getStringParam(params, "status")),
    q: getStringParam(params, "q"),
    limit: PAGE_SIZE,
    offset: getOffset(getStringParam(params, "offset")),
  };
  const response = await getRegisterSessionsQuery(requestedQuery)
    .then((data) => ({ data, error: undefined as string | undefined }))
    .catch((error: unknown) => ({
      data: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Register sessions failed to load.",
    }));
  const query: PointOfSaleRegisterSessionQuery = response.data
    ? {
        from: response.data.filters.from,
        to: response.data.filters.to,
        branchId: response.data.filters.branchId ?? undefined,
        status: response.data.filters.status ?? undefined,
        q: response.data.filters.q ?? undefined,
        limit: PAGE_SIZE,
        offset: response.data.offset,
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
          response.data?.timezone ?? "UTC",
        );

  return (
    <RegisterSessionsView
      error={response.error}
      query={query}
      result={response.data}
      selectedPreset={selectedPreset}
    />
  );
}
