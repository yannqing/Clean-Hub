"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";

import { downloadCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format";
import { useTenantI18n } from "@/i18n";

import {
  buildReportCsv,
  buildReportFilename,
  buildZReportCsv,
  type ReportExportLabels,
  type ZReportLabels,
} from "../export";
import {
  reportDatePresets,
  resolveReportDatePreset,
  type ReportDatePresetId,
} from "../date-presets";
import type { ReportSummary, ReportSummaryQuery } from "../types";

type ReportSummaryViewProps = {
  query: ReportSummaryQuery;
  summary?: ReportSummary;
  error?: string;
  /**
   * Tenant display name surfaced in the Z-Report header. Optional because the
   * report view doesn't always have tenant metadata in scope.
   */
  tenantName?: string;
  /**
   * ISO 4217 currency code to use when rendering monetary amounts. Falls back to
   * the platform default (`XOF`) when undefined so the report never renders in
   * a misleading currency such as USD.
   */
  currency?: string;
};

function formatPercent(part: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(part / total);
}

export function ReportSummaryView({
  query,
  summary,
  error,
  tenantName,
  currency,
}: ReportSummaryViewProps) {
  const { m, locale } = useTenantI18n();
  const paymentTotal = summary
    ? Object.values(summary.paymentBreakdown).reduce(
        (total, value) => total + value,
        0,
      )
    : 0;

  // Date-range preset selector. Choosing a preset fills the from/to inputs by
  // submitting the form (the inputs keep their `name` so the GET round-trips).
  const presetOptions: { id: ReportDatePresetId | "none"; label: string }[] = [
    { id: "none", label: m.reports.presets.none },
    ...reportDatePresets.map((preset) => ({
      id: preset.id,
      label: m.reports.presets[preset.id],
    })),
  ];

  function applyPreset(value: ReportDatePresetId | "none") {
    if (value === "none") {
      return;
    }

    const resolved = resolveReportDatePreset(value);
    if (!resolved) {
      return;
    }

    const fromInput = document.getElementById(
      "report-from",
    ) as HTMLInputElement | null;
    const toInput = document.getElementById(
      "report-to",
    ) as HTMLInputElement | null;

    if (fromInput) {
      fromInput.value = resolved.from ?? "";
    }
    if (toInput) {
      toInput.value = resolved.to ?? "";
    }
  }

  // Export labels shared by both CSV builders.
  const exportLabels: ReportExportLabels = {
    grossSales: m.reports.cards.grossSales,
    orderCount: m.reports.cards.orders,
    pendingPickup: m.reports.cards.pendingPickup,
    inProgress: m.reports.cards.inProgress,
    paymentBreakdown: m.reports.paymentBreakdown,
    paymentMethodLabels: m.reports.paymentMethodLabels,
    from: m.reports.formLabels.from,
    to: m.reports.formLabels.to,
    branchId: m.reports.formLabels.branchId,
    generatedAt: m.reports.csv.generatedAt,
    metricHeader: m.reports.csv.metricHeader,
    valueHeader: m.reports.csv.valueHeader,
  };

  const zReportLabels: ZReportLabels = {
    title: m.reports.zReport.title,
    storeName: m.reports.zReport.storeName,
    period: m.reports.zReport.period,
    generatedAt: m.reports.zReport.generatedAt,
    totals: m.reports.zReport.totals,
    paymentBreakdown: m.reports.paymentBreakdown,
    grossSales: m.reports.cards.grossSales,
    orderCount: m.reports.cards.orders,
    pendingPickup: m.reports.cards.pendingPickup,
    inProgress: m.reports.cards.inProgress,
    paymentMethodLabels: m.reports.paymentMethodLabels,
  };

  function handleExportCsv() {
    if (!summary) {
      toast.error(m.reports.exportToasts.noData);
      return;
    }

    try {
      const csv = buildReportCsv(summary, query, exportLabels);
      downloadCsv(buildReportFilename("report", query), csv);
      toast.success(m.reports.exportToasts.exported);
    } catch {
      toast.error(m.reports.exportToasts.failed);
    }
  }

  function handleExportZReport() {
    if (!summary) {
      toast.error(m.reports.exportToasts.noData);
      return;
    }

    try {
      const csv = buildZReportCsv(
        summary,
        query,
        tenantName,
        currency ?? "XOF",
        zReportLabels,
      );
      downloadCsv(buildReportFilename("z-report", query), csv);
      toast.success(m.reports.exportToasts.zReportExported);
    } catch {
      toast.error(m.reports.exportToasts.failed);
    }
  }

  return (
    <section className="min-h-[560px]">
      <div className="border-b p-5">
        <Badge variant="secondary">{m.reports.eyebrow}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {m.reports.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {m.reports.description}
        </p>
      </div>

      <form className="grid gap-4 border-b p-5 lg:grid-cols-[1fr_1fr_1fr_1fr_180px]" method="GET">
        <div className="grid gap-2">
          <Label htmlFor="report-preset">{m.reports.formLabels.preset}</Label>
          <Select
            onValueChange={(value) =>
              applyPreset(value as ReportDatePresetId | "none")
            }
            value="none"
          >
            <SelectTrigger id="report-preset">
              <SelectValue placeholder={m.reports.presets.none} />
            </SelectTrigger>
            <SelectContent>
              {presetOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-from">{m.reports.formLabels.from}</Label>
          <Input
            defaultValue={query.from}
            id="report-from"
            name="from"
            type="date"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-to">{m.reports.formLabels.to}</Label>
          <Input defaultValue={query.to} id="report-to" name="to" type="date" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="report-branch-id">{m.reports.formLabels.branchId}</Label>
          <Input
            defaultValue={query.branchId}
            id="report-branch-id"
            name="branchId"
            placeholder={m.reports.formLabels.branchPlaceholder}
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" type="submit">
            {m.reports.applyFilters}
          </Button>
        </div>
      </form>

      {error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : summary ? (
        <div className="grid gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {m.reports.cards.grossSales}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {formatMoney(summary.grossSales, currency, locale)}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {m.reports.cards.orders}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{summary.orderCount}</div>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {m.reports.cards.pendingPickup}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {summary.pendingPickupCount}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {m.reports.cards.inProgress}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {summary.inProgressCount}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle>{m.reports.paymentBreakdown}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {Object.entries(summary.paymentBreakdown).map(([method, amount]) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                    key={method}
                  >
                    <span className="capitalize text-sm">{method}</span>
                    <span className="text-sm font-medium">
                      {formatMoney(amount, currency, locale)} ·{" "}
                      {formatPercent(amount, paymentTotal)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle>{m.reports.exports}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  disabled={!summary}
                  onClick={handleExportCsv}
                  type="button"
                  variant="outline"
                >
                  {m.reports.exportButtons.export}
                </Button>
                <Button
                  disabled={!summary}
                  onClick={handleExportZReport}
                  type="button"
                  variant="outline"
                >
                  {m.reports.exportButtons.zReport}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}
