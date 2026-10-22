import { toCsvDocument } from "@/lib/csv";

import type { ReportSummary, ReportSummaryQuery } from "./types";

/** A CSV cell is any of these primitive shapes. */
type CsvCell = string | number | null | undefined;
type CsvRow = CsvCell[];

/** Localized labels passed into the builders so the exported file matches the UI locale. */
export type ReportExportLabels = {
  grossSales: string;
  taxableAmount: string;
  taxAmount: string;
  orderCount: string;
  pendingPickup: string;
  inProgress: string;
  paymentBreakdown: string;
  paymentMethodLabels: Record<keyof ReportSummary["paymentBreakdown"], string>;
  from: string;
  to: string;
  branchId: string;
  currency: string;
  generatedAt: string;
  metricHeader: string;
  valueHeader: string;
};

/** Build a stable, sortable filename like `report-2024-01-01_2024-01-31.csv`. */
export function buildReportFilename(
  prefix: "report" | "z-report",
  query: ReportSummaryQuery,
): string {
  const from = query.from ?? "start";
  const to = query.to ?? "today";
  return `${prefix}-${from}_${to}.csv`;
}

/**
 * Build a two-column CSV (Metric, Value) of the report summary.
 *
 * The header row carries the active filters + generation timestamp so the
 * exported file is self-describing. Payment-method rows are emitted under a
 * payment-breakdown section so the spreadsheet stays readable when filtered.
 */
export function buildReportCsv(
  summary: ReportSummary,
  query: ReportSummaryQuery,
  labels: ReportExportLabels,
  now: Date = new Date(),
): string {
  const metaRow: CsvRow = [
    `${labels.from}:`,
    query.from ?? "",
    `${labels.to}:`,
    query.to ?? "",
    `${labels.branchId}:`,
    query.branchId ?? "",
    `${labels.currency}:`,
    summary.currency,
    `${labels.generatedAt}:`,
    now.toISOString(),
  ];

  const blank: CsvRow = [];

  const kpiHeader: CsvRow = [labels.metricHeader, labels.valueHeader];
  const kpiRows: CsvRow[] = [
    [labels.grossSales, summary.grossSales],
    [labels.taxableAmount, summary.taxableAmount],
    [labels.taxAmount, summary.taxAmount],
    ...summary.taxComponents.flatMap((component): CsvRow[] => [
      [`${component.name} ${Number(component.rate) * 100}% — ${labels.taxableAmount}`, component.taxableAmount],
      [`${component.name} ${Number(component.rate) * 100}% — ${labels.taxAmount}`, component.taxAmount],
    ]),
    [labels.orderCount, summary.orderCount],
    [labels.pendingPickup, summary.pendingPickupCount],
    [labels.inProgress, summary.inProgressCount],
  ];

  const paymentSectionHeader: CsvRow = [labels.paymentBreakdown, ""];
  const paymentRows: CsvRow[] = (
    Object.keys(summary.paymentBreakdown) as Array<
      keyof ReportSummary["paymentBreakdown"]
    >
  ).map((method) => [
    labels.paymentMethodLabels[method] ?? method,
    summary.paymentBreakdown[method],
  ]);

  return toCsvDocument(metaRow, [
    blank,
    kpiHeader,
    ...kpiRows,
    blank,
    paymentSectionHeader,
    ...paymentRows,
  ]);
}

/** Localized labels for the Z-Report export. */
export type ZReportLabels = {
  title: string;
  storeName: string;
  period: string;
  generatedAt: string;
  totals: string;
  paymentBreakdown: string;
  grossSales: string;
  taxableAmount: string;
  taxAmount: string;
  orderCount: string;
  pendingPickup: string;
  inProgress: string;
  paymentMethodLabels: Record<keyof ReportSummary["paymentBreakdown"], string>;
};

/**
 * Build a Z-Report (daily close-out) as a two-column CSV.
 *
 * The Z-Report is what a cashier hands to accounting at end-of-day. Using CSV
 * keeps it spreadsheet-friendly while the label/value layout makes it print
 * cleanly. `tenantName` and `currency` are surfaced in dedicated header rows.
 */
export function buildZReportCsv(
  summary: ReportSummary,
  query: ReportSummaryQuery,
  tenantName: string | undefined,
  currency: string,
  labels: ZReportLabels,
  now: Date = new Date(),
): string {
  const header: CsvRow = [labels.title, ""];
  const meta: CsvRow[] = [
    [labels.storeName, tenantName ?? ""],
    [labels.period, `${query.from ?? ""} - ${query.to ?? ""}`],
    [
      labels.generatedAt,
      now.toLocaleString(undefined, { timeZone: summary.timezone }),
    ],
  ];

  const blank: CsvRow = [];

  const totalsHeader: CsvRow = [labels.totals, ""];
  const totalsRows: CsvRow[] = [
    [
      labels.grossSales,
      `${summary.grossSales} ${currency}`.trim(),
    ],
    [labels.taxableAmount, `${summary.taxableAmount} ${currency}`.trim()],
    [labels.taxAmount, `${summary.taxAmount} ${currency}`.trim()],
    ...summary.taxComponents.flatMap((component): CsvRow[] => [
      [`${component.name} ${Number(component.rate) * 100}% — ${labels.taxableAmount}`, `${component.taxableAmount} ${currency}`.trim()],
      [`${component.name} ${Number(component.rate) * 100}% — ${labels.taxAmount}`, `${component.taxAmount} ${currency}`.trim()],
    ]),
    [labels.orderCount, summary.orderCount],
    [labels.pendingPickup, summary.pendingPickupCount],
    [labels.inProgress, summary.inProgressCount],
  ];

  const paymentHeader: CsvRow = [labels.paymentBreakdown, ""];
  const paymentRows: CsvRow[] = (
    Object.keys(summary.paymentBreakdown) as Array<
      keyof ReportSummary["paymentBreakdown"]
    >
  ).map((method) => [
    labels.paymentMethodLabels[method] ?? method,
    `${summary.paymentBreakdown[method]} ${currency}`.trim(),
  ]);

  return toCsvDocument(header, [
    ...meta,
    blank,
    totalsHeader,
    ...totalsRows,
    blank,
    paymentHeader,
    ...paymentRows,
  ]);
}
