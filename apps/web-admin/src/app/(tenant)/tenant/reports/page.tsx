import {
  getReportSummaryQuery,
  ReportSummaryView,
  type ReportSummaryQuery,
} from "@/features/tenant/reports";

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
  const summary = await getReportSummaryQuery(query);

  return <ReportSummaryView query={query} summary={summary} />;
}
