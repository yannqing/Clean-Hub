import {
  getReportSummaryQuery,
  ReportSummaryView,
  type ReportSummaryQuery,
} from "@/features/tenant/reports";
import { getTenantSettingsQuery } from "@/features/tenant/settings/queries";

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
  const query: ReportSummaryQuery = {
    from: getStringParam(params, "from"),
    to: getStringParam(params, "to"),
    branchId: getStringParam(params, "branchId"),
  };

  // Run the report summary and tenant settings lookups in parallel. Settings is
  // fetched only to resolve the tenant's currency for display; if it fails we
  // fall back to the platform default currency (`XOF`) instead of blocking the
  // report. Both queries resolve their own request options so cookies/auth are
  // handled consistently with the rest of the app.
  const [reportResult, settingsResult] = await Promise.all([
    getReportSummaryQuery(query)
      .then((summary) => ({ summary, error: undefined as string | undefined }))
      .catch((error: unknown) => ({
        summary: undefined,
        error:
          error instanceof Error
            ? error.message
            : "Report summary failed to load.",
      })),
    getTenantSettingsQuery()
      .then((settings) => ({
        currency: settings?.defaultCurrency,
        tenantName: settings?.tenantName,
      }))
      .catch(() => ({ currency: undefined, tenantName: undefined })),
  ]);

  return (
    <ReportSummaryView
      currency={settingsResult.currency}
      error={reportResult.error}
      query={query}
      summary={reportResult.summary}
      tenantName={settingsResult.tenantName}
    />
  );
}
