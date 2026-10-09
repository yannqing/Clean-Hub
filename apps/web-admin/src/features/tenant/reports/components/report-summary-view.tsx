"use client";

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  CreditCard,
  Download,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

import {
  reportDatePresets,
  resolveReportDatePreset,
  type ReportDatePresetId,
} from "../date-presets";
import type { ReportSummary, ReportSummaryQuery } from "../types";
import { buildReportCsv, buildReportFilename } from "../export";

type ReportSummaryViewProps = {
  defaultCurrency: string;
  query: ReportSummaryQuery;
  summary?: ReportSummary;
  error?: string;
  selectedPreset: ReportDatePresetId | "custom";
};

type MetricProps = {
  change: number | null;
  icon: LucideIcon;
  label: string;
  locale: string;
  value: string;
};

const ALL_BRANCHES_VALUE = "__all_branches__";
const CHART_WIDTH = 640;
const CHART_HEIGHT = 210;
const CHART_PADDING_X = 12;
const CHART_PADDING_Y = 18;

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChange(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: "always",
    style: "percent",
  }).format(value / 100);
}

function formatShortDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function enumerateDates(from?: string, to?: string): string[] {
  if (!from || !to) {
    return [];
  }

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end ||
    dayCount > 366
  ) {
    return [];
  }

  const values: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end && values.length < 366) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return values;
}

function isDateRangeWithinLimit(from: string, to: string): boolean {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const days =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return !Number.isNaN(days) && start <= end && days > 0 && days <= 366;
}

function buildTrendSeries(
  trend: ReportSummary["salesTrend"],
  query: ReportSummaryQuery,
): ReportSummary["salesTrend"] {
  const indexed = new Map(trend.map((point) => [point.date, point]));
  const dates = enumerateDates(query.from, query.to);

  if (dates.length === 0) {
    return trend;
  }

  return dates.map(
    (date) =>
      indexed.get(date) ?? {
        date,
        grossSales: 0,
        orderCount: 0,
      },
  );
}

function Metric({ change, icon, label, locale, value }: MetricProps) {
  const hasComparison = change !== null;
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="flex size-7 items-center justify-center rounded-md bg-muted">
          <Icon className="text-foreground/70" icon={icon} size={14} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-xl font-semibold tracking-tight">{value}</span>
        <span
          className={cn(
            "inline-flex min-h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium",
            !hasComparison && "text-muted-foreground",
            isPositive && "bg-emerald-500/10 text-emerald-700",
            isNegative && "bg-red-500/10 text-red-700",
            hasComparison &&
              !isPositive &&
              !isNegative &&
              "bg-muted text-muted-foreground",
          )}
        >
          {isPositive ? <Icon icon={TrendingUp} size={11} /> : null}
          {isNegative ? <Icon icon={TrendingDown} size={11} /> : null}
          {change === null ? "—" : formatChange(change, locale)}
        </span>
      </div>
    </div>
  );
}

function SalesTrendChart({
  currency,
  emptyLabel,
  label,
  locale,
  points,
}: {
  currency: string;
  emptyLabel: string;
  label: string;
  locale: string;
  points: ReportSummary["salesTrend"];
}) {
  const hasData = points.some(
    (point) => point.grossSales > 0 || point.orderCount > 0,
  );
  const maximum = Math.max(...points.map((point) => point.grossSales), 1);
  const drawableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const coordinates = points.map((point, index) => {
    const denominator = Math.max(points.length - 1, 1);
    const x = CHART_PADDING_X + (index / denominator) * drawableWidth;
    const y =
      CHART_PADDING_Y +
      drawableHeight -
      (point.grossSales / maximum) * drawableHeight;

    return { ...point, x, y };
  });
  const linePath = coordinates
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates.at(-1)!.x.toFixed(2)} ${(
          CHART_HEIGHT - CHART_PADDING_Y
        ).toFixed(2)} L ${coordinates[0]!.x.toFixed(2)} ${(
          CHART_HEIGHT - CHART_PADDING_Y
        ).toFixed(2)} Z`
      : "";
  const labelIndexes = Array.from(
    new Set([
      0,
      Math.max(0, Math.floor((points.length - 1) / 2)),
      Math.max(0, points.length - 1),
    ]),
  );

  if (points.length === 0 || !hasData) {
    return (
      <div className="flex h-[238px] flex-col items-center justify-center rounded-lg bg-muted/40 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-background">
          <Icon
            className="text-muted-foreground"
            icon={ChartNoAxesCombined}
            size={17}
          />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-[210px] w-full">
        <svg
          aria-label={label}
          className="size-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          <defs>
            <linearGradient id="report-sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = CHART_PADDING_Y + drawableHeight * ratio;

            return (
              <line
                className="stroke-border"
                key={ratio}
                strokeDasharray="3 6"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                x1={CHART_PADDING_X}
                x2={CHART_WIDTH - CHART_PADDING_X}
                y1={y}
                y2={y}
              />
            );
          })}
          <path
            className="text-foreground"
            d={areaPath}
            fill="url(#report-sales-area)"
          />
          <path
            className="stroke-foreground"
            d={linePath}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {coordinates.length === 1 ? (
            <circle
              className="fill-foreground"
              cx={coordinates[0]!.x}
              cy={coordinates[0]!.y}
              r="3"
            />
          ) : null}
        </svg>
      </div>

      <div className="relative mt-2 h-5 text-[11px] text-muted-foreground">
        {labelIndexes.map((index) => {
          const point = points[index];
          const alignment =
            index === 0
              ? "translate-x-0"
              : index === points.length - 1
                ? "-translate-x-full"
                : "-translate-x-1/2";

          if (!point) {
            return null;
          }

          return (
            <span
              className={cn("absolute whitespace-nowrap", alignment)}
              key={`${point.date}-${index}`}
              style={{
                left: `${(index / Math.max(points.length - 1, 1)) * 100}%`,
              }}
              title={formatMoney(point.grossSales, currency, locale)}
            >
              {formatShortDate(point.date, locale)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ReportSummaryView({
  defaultCurrency,
  query,
  summary,
  error,
  selectedPreset,
}: ReportSummaryViewProps) {
  const { locale, m } = useTenantI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(query.from ?? "");
  const [customTo, setCustomTo] = useState(query.to ?? "");
  const currency = summary?.currency ?? query.currency ?? defaultCurrency;
  const taxCopy = locale === "zh-CN"
    ? { taxable: "订单应税金额", tax: "订单原始税额（未扣退款）", export: "下载 CSV", metric: "指标", value: "数值", generated: "生成时间" }
    : locale === "fr"
      ? { taxable: "Base imposable", tax: "TVA brute (avant remboursements)", export: "Télécharger CSV", metric: "Indicateur", value: "Valeur", generated: "Généré le" }
      : { taxable: "Taxable amount", tax: "Gross tax (before refunds)", export: "Download CSV", metric: "Metric", value: "Value", generated: "Generated at" };
  const trend = useMemo(
    () => buildTrendSeries(summary?.salesTrend ?? [], query),
    [query, summary?.salesTrend],
  );

  function navigate(next: Partial<ReportSummaryQuery>) {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();

    if (merged.from) {
      params.set("from", merged.from);
    }
    if (merged.to) {
      params.set("to", merged.to);
    }
    if (merged.branchId) {
      params.set("branchId", merged.branchId);
    }
    if (merged.currency) {
      params.set("currency", merged.currency);
    }

    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  function handlePresetChange(value: string) {
    if (value === "custom") {
      setCustomFrom(query.from ?? "");
      setCustomTo(query.to ?? "");
      setCustomRangeOpen(true);
      return;
    }

    const range = resolveReportDatePreset(
      value as ReportDatePresetId,
      new Date(),
      summary?.timezone ?? "UTC",
    );
    if (range) {
      navigate(range);
    }
  }

  function handleCustomRangeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !customFrom ||
      !customTo ||
      !isDateRangeWithinLimit(customFrom, customTo)
    ) {
      return;
    }

    setCustomRangeOpen(false);
    navigate({
      from: customFrom,
      to: customTo,
    });
  }

  const statusEntries = summary
    ? [
        {
          color: "bg-foreground",
          label: m.reports.orderStatus.labels.delivered,
          value: summary.orderStatusBreakdown.delivered,
        },
        {
          color: "bg-foreground/70",
          label: m.reports.orderStatus.labels.paid,
          value: summary.orderStatusBreakdown.paid,
        },
        {
          color: "bg-foreground/45",
          label: m.reports.orderStatus.labels.received,
          value: summary.orderStatusBreakdown.received,
        },
        {
          color: "bg-foreground/25",
          label: m.reports.orderStatus.labels.draft,
          value: summary.orderStatusBreakdown.draft,
        },
        {
          color: "bg-foreground/10",
          label: m.reports.orderStatus.labels.cancelled,
          value: summary.orderStatusBreakdown.cancelled,
        },
      ]
    : [];
  const statusTotal = statusEntries.reduce(
    (total, entry) => total + entry.value,
    0,
  );
  const paymentEntries = summary
    ? [
        {
          icon: Banknote,
          label: m.reports.paymentMethods.cash,
          value: summary.paymentBreakdown.cash,
        },
        {
          icon: Smartphone,
          label: m.reports.paymentMethods.mobile,
          value: summary.paymentBreakdown.mobile,
        },
        {
          icon: CreditCard,
          label: m.reports.paymentMethods.card,
          value: summary.paymentBreakdown.card,
        },
        {
          icon: WalletCards,
          label: m.reports.paymentMethods.other,
          value: summary.paymentBreakdown.other,
        },
      ]
    : [];
  const paymentTotal = paymentEntries.reduce(
    (total, entry) => total + entry.value,
    0,
  );
  const topBranch = summary?.branchPerformance[0];
  const insight = !summary
    ? null
    : summary.overdueCount > 0
      ? {
          description: interpolate(m.reports.insight.overdueDescription, {
            count: formatCount(summary.overdueCount, locale),
          }),
          title: m.reports.insight.overdueTitle,
        }
      : summary.pendingPickupCount > 0
        ? {
            description: interpolate(m.reports.insight.pickupDescription, {
              count: formatCount(summary.pendingPickupCount, locale),
            }),
            title: m.reports.insight.pickupTitle,
          }
        : topBranch &&
            topBranch.grossSales > 0 &&
            summary.branchPerformance.length > 1
          ? {
              description: interpolate(m.reports.insight.topBranchDescription, {
                branch: topBranch.branchName,
              }),
              title: m.reports.insight.topBranchTitle,
            }
          : {
              description: m.reports.insight.healthyDescription,
              title: m.reports.insight.healthyTitle,
            };

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[1120px] space-y-7 pb-10 transition-opacity",
        isPending && "opacity-65",
      )}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
            <Icon icon={ChartNoAxesCombined} size={16} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {m.reports.title}
          </h1>
        </div>
        {summary ? (
          <span className="hidden text-xs text-muted-foreground sm:block">
            {m.reports.generatedAt}{" "}
            {new Intl.DateTimeFormat(locale, {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: summary.timezone,
              timeZoneName: "short",
            }).format(new Date(summary.generatedAt))}
          </span>
        ) : null}
      </header>

      <section className="relative overflow-hidden rounded-xl border bg-background">
        <div className="grid min-h-[220px] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative z-10 flex flex-col items-start justify-center px-6 py-8 sm:px-9">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              <Icon icon={Sparkles} size={12} />
              {m.reports.hero.badge}
            </span>
            <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-[28px]">
              {m.reports.hero.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {m.reports.hero.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={webAdminRoutes.tenant.orders}>
                  {m.reports.hero.viewOrders}
                  <Icon icon={ArrowRight} size={14} />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={webAdminRoutes.tenant.branches}>
                  {m.reports.hero.viewBranches}
                </Link>
              </Button>
            </div>
          </div>

          <div
            aria-hidden
            className="relative hidden min-h-[220px] overflow-hidden bg-muted/50 lg:block"
          >
            <div className="absolute -right-10 -top-16 size-52 rounded-full border-[28px] border-foreground/[0.04]" />
            <div className="absolute -bottom-20 left-2 size-52 rounded-full border-[32px] border-foreground/[0.035]" />
            <div className="absolute inset-x-10 bottom-7 top-7 rounded-xl border bg-background/95 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-2 w-20 rounded-full bg-muted-foreground/20" />
                  <div className="mt-2 h-5 w-32 rounded-md bg-foreground/85" />
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <Icon icon={TrendingUp} size={15} />
                </div>
              </div>
              <div className="mt-6 flex h-20 items-end gap-2">
                {[34, 51, 43, 68, 56, 82, 72, 94].map((height, index) => (
                  <div
                    className={cn(
                      "flex-1 rounded-t-sm bg-foreground/15",
                      index === 7 && "bg-foreground",
                    )}
                    key={`${height}-${index}`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[60, 84, 70].map((width, index) => (
                  <div className="rounded-lg bg-muted p-2" key={index}>
                    <div
                      className="h-1.5 rounded-full bg-muted-foreground/20"
                      style={{ width: `${width}%` }}
                    />
                    <div className="mt-2 h-3 w-10 rounded-sm bg-foreground/70" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold">
              {m.reports.performance.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.reports.performance.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {summary ? (
              <Button
                onClick={() => {
                  const exportQuery = {
                    ...query,
                    from: query.from ?? summary.filters.from ?? undefined,
                    to: query.to ?? summary.filters.to ?? undefined,
                  };
                  downloadCsv(
                    buildReportFilename("report", exportQuery),
                    buildReportCsv(summary, exportQuery, {
                      grossSales: m.reports.metrics.grossSales,
                      taxableAmount: taxCopy.taxable,
                      taxAmount: taxCopy.tax,
                      orderCount: m.reports.metrics.orders,
                      pendingPickup: m.reports.operations.pendingPickup,
                      inProgress: m.reports.operations.inProgress,
                      paymentBreakdown: m.reports.payments.title,
                      paymentMethodLabels: m.reports.paymentMethods,
                      from: m.reports.customRange.from,
                      to: m.reports.customRange.to,
                      branchId: m.reports.performance.branch,
                      currency: m.reports.performance.currency,
                      generatedAt: taxCopy.generated,
                      metricHeader: taxCopy.metric,
                      valueHeader: taxCopy.value,
                    }),
                  );
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon icon={Download} size={14} />
                {taxCopy.export}
              </Button>
            ) : null}
            <Select
              disabled={isPending}
              onValueChange={handlePresetChange}
              value={selectedPreset}
            >
              <SelectTrigger
                aria-label={m.reports.performance.dateRange}
                className="h-8 min-w-[150px] bg-background text-xs"
                size="sm"
              >
                <Icon icon={CalendarDays} size={14} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {reportDatePresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {m.reports.presets[preset.id]}
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  {m.reports.presets.custom}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              disabled={isPending || !summary}
              onValueChange={(value) =>
                navigate({
                  branchId: value === ALL_BRANCHES_VALUE ? undefined : value,
                })
              }
              value={query.branchId ?? ALL_BRANCHES_VALUE}
            >
              <SelectTrigger
                aria-label={m.reports.performance.branch}
                className="h-8 min-w-[150px] bg-background text-xs"
                size="sm"
              >
                <Icon icon={Building2} size={14} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_BRANCHES_VALUE}>
                  {m.reports.performance.allBranches}
                </SelectItem>
                {summary?.availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {summary ? (
              <Select
                disabled={isPending}
                onValueChange={(value) => navigate({ currency: value })}
                value={summary.currency}
              >
                <SelectTrigger
                  aria-label={m.reports.performance.currency}
                  className="h-8 min-w-[105px] bg-background text-xs"
                  size="sm"
                >
                  <Icon icon={WalletCards} size={14} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {summary.availableCurrencies.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <Dialog onOpenChange={setCustomRangeOpen} open={customRangeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.reports.customRange.title}</DialogTitle>
              <DialogDescription>
                {m.reports.customRange.description}
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-5" onSubmit={handleCustomRangeSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="report-custom-from">
                    {m.reports.customRange.from}
                  </Label>
                  <Input
                    id="report-custom-from"
                    max={customTo || undefined}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    required
                    type="date"
                    value={customFrom}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="report-custom-to">
                    {m.reports.customRange.to}
                  </Label>
                  <Input
                    id="report-custom-to"
                    min={customFrom || undefined}
                    onChange={(event) => setCustomTo(event.target.value)}
                    required
                    type="date"
                    value={customTo}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setCustomRangeOpen(false)}
                  type="button"
                  variant="outline"
                >
                  {m.reports.customRange.cancel}
                </Button>
                <Button
                  disabled={
                    !customFrom ||
                    !customTo ||
                    !isDateRangeWithinLimit(customFrom, customTo) ||
                    isPending
                  }
                  type="submit"
                >
                  {m.reports.customRange.apply}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            <p className="font-medium">{m.reports.errorTitle}</p>
            <p className="mt-1 text-xs opacity-80">
              {m.reports.errorDescription}
            </p>
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                change={summary.changes.grossSales}
                icon={WalletCards}
                label={m.reports.metrics.grossSales}
                locale={locale}
                value={formatMoney(summary.grossSales, currency, locale)}
              />
              <Metric
                change={summary.changes.orderCount}
                icon={ShoppingBag}
                label={m.reports.metrics.orders}
                locale={locale}
                value={formatCount(summary.orderCount, locale)}
              />
              <Metric
                change={summary.changes.averageOrderValue}
                icon={ReceiptText}
                label={m.reports.metrics.averageOrderValue}
                locale={locale}
                value={formatMoney(summary.averageOrderValue, currency, locale)}
              />
              <Metric
                change={summary.changes.uniqueCustomerCount}
                icon={UsersRound}
                label={m.reports.metrics.customers}
                locale={locale}
                value={formatCount(summary.uniqueCustomerCount, locale)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric change={null} icon={ReceiptText} label={taxCopy.taxable} locale={locale} value={formatMoney(summary.taxableAmount, currency, locale)} />
              <Metric change={null} icon={ReceiptText} label={taxCopy.tax} locale={locale} value={formatMoney(summary.taxAmount, currency, locale)} />
            </div>
            {summary.taxComponents.length > 0 ? <div className="grid gap-3 sm:grid-cols-3">
              {summary.taxComponents.map((component) => <Metric key={`${component.name}:${component.rate}`} change={null} icon={ReceiptText} label={`${component.name} ${Number(component.rate) * 100}%`} locale={locale} value={formatMoney(component.taxAmount, currency, locale)} />)}
            </div> : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="gap-0 rounded-xl py-0 shadow-xs">
                <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {m.reports.salesTrend.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.reports.salesTrend.description}
                    </p>
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    {formatMoney(summary.grossSales, currency, locale)}
                  </span>
                </div>
                <CardContent className="px-5 pb-5 pt-3">
                  <SalesTrendChart
                    currency={currency}
                    emptyLabel={m.reports.salesTrend.empty}
                    label={m.reports.salesTrend.title}
                    locale={locale}
                    points={trend}
                  />
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-xl py-0 shadow-xs">
                <div className="px-5 pb-1 pt-5">
                  <h3 className="text-sm font-semibold">
                    {m.reports.orderStatus.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.reports.orderStatus.description}
                  </p>
                </div>
                <CardContent className="px-5 pb-5 pt-6">
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    {statusEntries.map((entry) =>
                      entry.value > 0 ? (
                        <span
                          className={entry.color}
                          key={entry.label}
                          style={{
                            width: `${(entry.value / Math.max(statusTotal, 1)) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div className="mt-7 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {statusEntries.map((entry) => (
                      <div
                        className="flex items-center justify-between gap-3"
                        key={entry.label}
                      >
                        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn("size-2 rounded-full", entry.color)}
                          />
                          <span className="truncate">{entry.label}</span>
                        </span>
                        <span className="text-sm font-medium">
                          {formatCount(entry.value, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {statusTotal === 0 ? (
                    <p className="mt-8 text-center text-xs text-muted-foreground">
                      {m.reports.orderStatus.empty}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-xl py-0 shadow-xs">
                <div className="px-5 pb-1 pt-5">
                  <h3 className="text-sm font-semibold">
                    {m.reports.payments.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.reports.payments.description}
                  </p>
                </div>
                <CardContent className="space-y-4 px-5 pb-5 pt-5">
                  {paymentEntries.map((entry) => {
                    const percentage =
                      paymentTotal > 0 ? (entry.value / paymentTotal) * 100 : 0;

                    return (
                      <div key={entry.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-xs">
                            <Icon
                              className="text-muted-foreground"
                              icon={entry.icon}
                              size={14}
                            />
                            {entry.label}
                          </span>
                          <span className="text-xs font-medium">
                            {formatMoney(entry.value, currency, locale)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {paymentTotal === 0 ? (
                    <p className="pt-4 text-center text-xs text-muted-foreground">
                      {m.reports.payments.empty}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-xl py-0 shadow-xs">
                <div className="px-5 pb-1 pt-5">
                  <h3 className="text-sm font-semibold">
                    {m.reports.operations.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.reports.operations.description}
                  </p>
                </div>
                <CardContent className="grid gap-3 px-5 pb-5 pt-5">
                  {[
                    {
                      icon: PackageCheck,
                      label: m.reports.operations.pendingPickup,
                      value: summary.pendingPickupCount,
                    },
                    {
                      icon: Clock3,
                      label: m.reports.operations.inProgress,
                      value: summary.inProgressCount,
                    },
                    {
                      icon: CalendarDays,
                      label: m.reports.operations.overdue,
                      value: summary.overdueCount,
                    },
                  ].map((entry) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-muted/55 px-3.5 py-3"
                      key={entry.label}
                    >
                      <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="flex size-7 items-center justify-center rounded-md bg-background">
                          <Icon icon={entry.icon} size={14} />
                        </span>
                        {entry.label}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCount(entry.value, locale)}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    {m.reports.operations.snapshotHint}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </section>

      {summary && insight ? (
        <section className="overflow-hidden rounded-xl border bg-foreground text-background">
          <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:flex-row sm:items-center sm:px-8">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background/10">
                <Icon icon={Sparkles} size={17} />
              </span>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-background/55">
                  {m.reports.insight.badge}
                </span>
                <h2 className="mt-1 text-base font-semibold">
                  {insight.title}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-background/65">
                  {insight.description}
                </p>
              </div>
            </div>
            <Button
              asChild
              className="self-start sm:self-auto"
              size="sm"
              variant="secondary"
            >
              <Link href={webAdminRoutes.tenant.orders}>
                {m.reports.insight.action}
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {summary ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">
              {m.reports.branches.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.reports.branches.description}
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-background">
            {summary.branchPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <DataTable
                  className="w-full text-left text-sm"
                  density="comfortable"
                >
                  <TableHeader className="border-b bg-muted/45 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <TableRow>
                      <TableHead className="px-5 py-3 font-medium">
                        {m.reports.branches.branch}
                      </TableHead>
                      <TableHead className="px-5 py-3 text-right font-medium">
                        {m.reports.branches.orders}
                      </TableHead>
                      <TableHead className="px-5 py-3 text-right font-medium">
                        {m.reports.branches.sales}
                      </TableHead>
                      <TableHead className="w-[190px] px-5 py-3 font-medium">
                        {m.reports.branches.share}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {summary.branchPerformance.map((branch) => {
                      const share =
                        summary.grossSales > 0
                          ? (branch.grossSales / summary.grossSales) * 100
                          : 0;

                      return (
                        <TableRow
                          className="hover:bg-muted/30"
                          key={branch.branchId}
                        >
                          <TableCell className="px-5 py-3.5 font-medium">
                            <span className="flex items-center gap-2.5">
                              <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                                <Icon icon={Building2} size={13} />
                              </span>
                              {branch.branchName}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right text-muted-foreground">
                            {formatCount(branch.orderCount, locale)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-medium">
                            {formatMoney(branch.grossSales, currency, locale)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-foreground"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="w-10 text-right text-xs text-muted-foreground">
                                {Math.round(share)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </DataTable>
              </div>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Icon
                    className="text-muted-foreground"
                    icon={Building2}
                    size={16}
                  />
                </span>
                <p className="mt-3 text-sm font-medium">
                  {m.reports.branches.emptyTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.reports.branches.emptyDescription}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
