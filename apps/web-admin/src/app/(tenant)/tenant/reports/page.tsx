import {
  DEFAULT_REPORT_DATE_PRESET,
  getReportSummaryQuery,
  ReportSummaryView,
  resolveReportDatePreset,
  resolveSelectedReportDatePreset,
  type ReportSummaryQuery,
} from "@/features/tenant/reports";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantDefaultCurrencyQuery } from "@/features/tenant/settings/queries";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = (await searchParams) ?? {};
  const defaultCurrency = await getTenantDefaultCurrencyQuery(
    await getTenantServerApiRequestOptions(),
  );
  const requestedQuery: ReportSummaryQuery = {
    from: getStringParam(params, "from"),
    to: getStringParam(params, "to"),
    branchId: getStringParam(params, "branchId"),
    currency: getStringParam(params, "currency"),
  };
  const reportResult = await getReportSummaryQuery(requestedQuery)
    .then((summary) => ({ summary, error: undefined as string | undefined }))
    .catch((error: unknown) => ({
      summary: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Report summary failed to load.",
    }));
  const fallbackRange = resolveReportDatePreset(DEFAULT_REPORT_DATE_PRESET);
  const query: ReportSummaryQuery = reportResult.summary
    ? {
        from: reportResult.summary.filters.from ?? undefined,
        to: reportResult.summary.filters.to ?? undefined,
        branchId: reportResult.summary.filters.branchId ?? undefined,
        currency: reportResult.summary.currency,
      }
    : {
        ...fallbackRange,
        ...requestedQuery,
      };
  const selectedPreset =
    !requestedQuery.from && !requestedQuery.to
      ? DEFAULT_REPORT_DATE_PRESET
      : resolveSelectedReportDatePreset(
          query,
          new Date(),
          reportResult.summary?.timezone ?? "UTC",
        );

  return (
    <ReportSummaryView
      defaultCurrency={defaultCurrency}
      error={reportResult.error}
      query={query}
      selectedPreset={selectedPreset}
      summary={reportResult.summary}
    />
  );
}
