import {
  DEFAULT_FINANCE_DATE_PRESET,
  FinanceSummaryView,
  getFinanceSummaryQuery,
  resolveFinanceDatePreset,
  resolveSelectedFinanceDatePreset,
  type FinanceSummaryQuery,
} from "@/features/tenant/finance";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantDefaultCurrencyQuery } from "@/features/tenant/settings/queries";

type FinancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const params = (await searchParams) ?? {};
  const defaultCurrency = await getTenantDefaultCurrencyQuery(
    await getTenantServerApiRequestOptions(),
  );
  const requestedQuery: FinanceSummaryQuery = {
    from: getStringParam(params, "from"),
    to: getStringParam(params, "to"),
    branchId: getStringParam(params, "branchId"),
    currency: getStringParam(params, "currency"),
  };
  const result = await getFinanceSummaryQuery(requestedQuery)
    .then((summary) => ({ summary, error: undefined as string | undefined }))
    .catch((error: unknown) => ({
      summary: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Finance summary failed to load.",
    }));
  const fallbackRange = resolveFinanceDatePreset(DEFAULT_FINANCE_DATE_PRESET);
  const query: FinanceSummaryQuery = result.summary
    ? {
        from: result.summary.filters.from,
        to: result.summary.filters.to,
        branchId: result.summary.filters.branchId ?? undefined,
        currency: result.summary.currency,
      }
    : {
        ...fallbackRange,
        ...requestedQuery,
      };
  const selectedPreset =
    !requestedQuery.from && !requestedQuery.to
      ? DEFAULT_FINANCE_DATE_PRESET
      : resolveSelectedFinanceDatePreset(
          query,
          new Date(),
          result.summary?.timezone ?? "UTC",
        );

  return (
    <FinanceSummaryView
      defaultCurrency={defaultCurrency}
      error={result.error}
      query={query}
      selectedPreset={selectedPreset}
      summary={result.summary}
    />
  );
}
