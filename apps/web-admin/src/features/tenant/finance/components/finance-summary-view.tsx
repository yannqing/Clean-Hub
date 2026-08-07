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
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  HandCoins,
  Info,
  Landmark,
  ReceiptText,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  financeDatePresets,
  resolveFinanceDatePreset,
  type FinanceDatePresetId,
} from "../date-presets";
import type {
  FinancePaymentMethod,
  FinanceSummary,
  FinanceSummaryQuery,
  FinanceTransactionDirection,
  FinanceTransactionKind,
  FinanceTransactionStatus,
} from "../types";

type FinanceSummaryViewProps = {
  defaultCurrency: string;
  query: FinanceSummaryQuery;
  selectedPreset: FinanceDatePresetId | "custom";
  summary?: FinanceSummary;
  error?: string;
};

type SmallMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "negative" | "positive";
};

const ALL_BRANCHES_VALUE = "__all_branches__";
const CHART_WIDTH = 680;
const CHART_HEIGHT = 200;
const CHART_PADDING_X = 10;
const CHART_PADDING_Y = 16;

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
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

function formatTenantDateTime(
  value: string,
  locale: string,
  timeZone: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

function isDateRangeWithinLimit(from: string, to: string): boolean {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const days =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return !Number.isNaN(days) && start <= end && days > 0 && days <= 366;
}

function SmallMetric({
  icon,
  label,
  tone = "default",
  value,
}: SmallMetricProps) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon={icon} size={14} />
        <span>{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-base font-semibold tracking-tight",
          tone === "negative" && "text-red-600",
          tone === "positive" && "text-emerald-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FinanceTrendChart({
  currency,
  emptyLabel,
  grossLabel,
  locale,
  netLabel,
  points,
}: {
  currency: string;
  emptyLabel: string;
  grossLabel: string;
  locale: string;
  netLabel: string;
  points: FinanceSummary["dailyTrend"];
}) {
  const hasData = points.some(
    (point) => point.grossCollected !== 0 || point.netCollected !== 0,
  );
  const values = points.flatMap((point) => [
    point.grossCollected,
    point.netCollected,
  ]);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = Math.max(maximum - minimum, 1);
  const drawableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const coordinates = (key: "grossCollected" | "netCollected") =>
    points.map((point, index) => {
      const denominator = Math.max(points.length - 1, 1);
      const x = CHART_PADDING_X + (index / denominator) * drawableWidth;
      const y =
        CHART_PADDING_Y +
        drawableHeight -
        ((point[key] - minimum) / range) * drawableHeight;

      return { ...point, x, y };
    });
  const pathFor = (key: "grossCollected" | "netCollected") =>
    coordinates(key)
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
  const labelPoints =
    points.length <= 4
      ? points
      : [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)];

  if (!hasData) {
    return (
      <div className="flex h-[230px] flex-col items-center justify-center text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon
            className="text-muted-foreground"
            icon={CircleDollarSign}
            size={18}
          />
        </span>
        <p className="mt-3 text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground" />
          {netLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          {grossLabel}
        </span>
        <span className="ml-auto hidden text-xs sm:block">
          {formatMoney(maximum, currency, locale)}
        </span>
      </div>
      <div className="mt-3 overflow-hidden">
        <svg
          aria-label={`${netLabel} / ${grossLabel}`}
          className="h-[200px] w-full"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              className="stroke-border"
              key={ratio}
              strokeDasharray="4 5"
              strokeWidth="1"
              x1={0}
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT * ratio}
              y2={CHART_HEIGHT * ratio}
            />
          ))}
          <path
            className="fill-none stroke-muted-foreground/35"
            d={pathFor("grossCollected")}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            className="fill-none stroke-foreground"
            d={pathFor("netCollected")}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {labelPoints.filter(Boolean).map((point) => (
          <span key={point?.date}>
            {point ? formatShortDate(point.date, locale) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function paymentMethodIcon(method: FinancePaymentMethod): LucideIcon {
  switch (method) {
    case "cash":
      return Banknote;
    case "card":
      return CreditCard;
    case "app":
      return WalletCards;
    case "unknown":
      return CircleDollarSign;
  }
}

export function FinanceSummaryView({
  defaultCurrency,
  error,
  query,
  selectedPreset,
  summary,
}: FinanceSummaryViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, m } = useTenantI18n();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(query.from ?? "");
  const [customTo, setCustomTo] = useState(query.to ?? "");
  const currency = summary?.currency ?? query.currency ?? defaultCurrency;

  const methodLabels: Record<FinancePaymentMethod, string> = {
    app: m.finance.paymentMethods.labels.app,
    card: m.finance.paymentMethods.labels.card,
    cash: m.finance.paymentMethods.labels.cash,
    unknown: m.finance.paymentMethods.labels.unknown,
  };
  const kindLabels: Record<FinanceTransactionKind, string> = {
    correction: m.finance.activity.kinds.correction,
    payment: m.finance.activity.kinds.payment,
    refund: m.finance.activity.kinds.refund,
  };
  const directionLabels: Record<FinanceTransactionDirection, string> = {
    credit: m.finance.activity.directions.credit,
    debit: m.finance.activity.directions.debit,
  };
  const statusLabels: Record<FinanceTransactionStatus, string> = {
    completed: m.finance.activity.statuses.completed,
    paid: m.finance.activity.statuses.paid,
    refunded: m.finance.activity.statuses.refunded,
  };

  const navigate = (
    changes: Partial<FinanceSummaryQuery>,
    options?: { clearBranch?: boolean },
  ) => {
    const next = new URLSearchParams();
    const values: FinanceSummaryQuery = {
      ...query,
      ...changes,
    };

    if (options?.clearBranch) {
      delete values.branchId;
    }

    if (values.from) next.set("from", values.from);
    if (values.to) next.set("to", values.to);
    if (values.branchId) next.set("branchId", values.branchId);
    if (values.currency) next.set("currency", values.currency);

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  const handlePresetChange = (value: string) => {
    if (value === "custom") {
      setCustomFrom(query.from ?? "");
      setCustomTo(query.to ?? "");
      setCustomRangeOpen(true);
      return;
    }

    const range = resolveFinanceDatePreset(
      value as FinanceDatePresetId,
      new Date(),
      summary?.timezone ?? "UTC",
    );
    navigate(range);
  };

  const handleCustomRangeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
  };

  const handleExport = () => {
    if (!summary || summary.recentTransactions.length === 0) {
      return;
    }

    setIsExporting(true);

    try {
      const headers = m.finance.exportHeaders;
      const rows = summary.recentTransactions.map((transaction) => [
        transaction.id,
        formatTenantDateTime(transaction.occurredAt, locale, summary.timezone),
        kindLabels[transaction.kind],
        directionLabels[transaction.direction],
        statusLabels[transaction.status],
        transaction.amount,
        transaction.currency,
        methodLabels[transaction.paymentMethod],
        transaction.branchName,
        transaction.orderId,
      ]);
      const csv = [
        [
          headers.id,
          headers.date,
          headers.type,
          headers.direction,
          headers.status,
          headers.amount,
          headers.currency,
          headers.method,
          headers.branch,
          headers.order,
        ],
        ...rows,
      ]
        .map((row) => row.map(escapeCsvCell).join(","))
        .join("\r\n");
      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cleanhub-finance-${summary.filters.from}-${summary.filters.to}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setIsExporting(false);
    }
  };

  const totalMethodNet = useMemo(
    () =>
      summary?.paymentMethods.reduce(
        (total, method) => total + method.netCollected,
        0,
      ) ?? 0,
    [summary],
  );

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[1180px] space-y-5 pb-10 transition-opacity",
        isPending && "opacity-65",
      )}
    >
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg border bg-background">
            <Icon icon={Landmark} size={16} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {m.finance.title}
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {m.finance.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button asChild size="sm" variant="outline">
            <a href="#finance-methodology">
              <Icon icon={FileText} size={14} />
              {m.finance.documentation}
            </a>
          </Button>
          <Button
            disabled={
              isExporting || !summary || summary.recentTransactions.length === 0
            }
            onClick={handleExport}
            size="sm"
            type="button"
          >
            <Icon icon={Download} size={14} />
            {isExporting ? m.finance.exporting : m.finance.exportCsv}
          </Button>
        </div>
      </header>

      <section
        className="overflow-hidden rounded-xl border bg-foreground text-background"
        id="finance-methodology"
      >
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background/10">
            <Icon icon={Info} size={18} />
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-background/55">
              {m.finance.notice.badge}
            </span>
            <h2 className="mt-1 text-sm font-semibold">
              {m.finance.notice.title}
            </h2>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-background/65">
              {m.finance.notice.description}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center">
        {summary ? (
          <p className="text-[11px] text-muted-foreground">
            {m.finance.generatedAt}{" "}
            {formatTenantDateTime(
              summary.generatedAt,
              locale,
              summary.timezone,
            )}
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            disabled={isPending}
            onValueChange={handlePresetChange}
            value={selectedPreset}
          >
            <SelectTrigger
              aria-label={m.finance.filters.dateRange}
              className="h-8 min-w-[145px] bg-background text-xs"
              size="sm"
            >
              <Icon icon={CalendarDays} size={14} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {financeDatePresets.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {m.finance.presets[preset]}
                </SelectItem>
              ))}
              <SelectItem value="custom">{m.finance.presets.custom}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            disabled={isPending || !summary}
            onValueChange={(value) =>
              navigate(
                {
                  branchId: value === ALL_BRANCHES_VALUE ? undefined : value,
                },
                { clearBranch: value === ALL_BRANCHES_VALUE },
              )
            }
            value={query.branchId ?? ALL_BRANCHES_VALUE}
          >
            <SelectTrigger
              aria-label={m.finance.filters.branch}
              className="h-8 min-w-[145px] bg-background text-xs"
              size="sm"
            >
              <Icon icon={Building2} size={14} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={ALL_BRANCHES_VALUE}>
                {m.finance.filters.allBranches}
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
              onValueChange={(value) =>
                navigate({ currency: value }, { clearBranch: false })
              }
              value={summary.currency}
            >
              <SelectTrigger
                aria-label={m.finance.filters.currency}
                className="h-8 min-w-[100px] bg-background text-xs"
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
            <DialogTitle>{m.finance.customRange.title}</DialogTitle>
            <DialogDescription>
              {m.finance.customRange.description}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-5" onSubmit={handleCustomRangeSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="finance-custom-from">
                  {m.finance.customRange.from}
                </Label>
                <Input
                  id="finance-custom-from"
                  max={customTo || undefined}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  required
                  type="date"
                  value={customFrom}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="finance-custom-to">
                  {m.finance.customRange.to}
                </Label>
                <Input
                  id="finance-custom-to"
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
                {m.finance.customRange.cancel}
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
                {m.finance.customRange.apply}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error ? (
        <div
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm"
          role="alert"
        >
          <p className="font-medium">{m.finance.errorTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.finance.errorDescription}
          </p>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_340px]">
            <Card className="overflow-hidden rounded-xl">
              <CardContent className="p-0">
                <div className="border-b px-5 py-5 sm:px-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {m.finance.overview.title}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {m.finance.overview.description}
                      </p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon icon={HandCoins} size={17} />
                    </span>
                  </div>
                  <p className="mt-6 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                    {formatMoney(
                      summary.summary.netCollected,
                      currency,
                      locale,
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.finance.overview.netCollectedHint}
                  </p>
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <SmallMetric
                      icon={ArrowDownLeft}
                      label={m.finance.overview.grossCollected}
                      tone="positive"
                      value={formatMoney(
                        summary.summary.grossCollected,
                        currency,
                        locale,
                      )}
                    />
                    <SmallMetric
                      icon={ArrowUpRight}
                      label={m.finance.overview.refunds}
                      tone="negative"
                      value={formatMoney(
                        summary.summary.refundAmount,
                        currency,
                        locale,
                      )}
                    />
                    <SmallMetric
                      icon={Wrench}
                      label={m.finance.overview.corrections}
                      value={formatMoney(
                        summary.summary.correctionAmount,
                        currency,
                        locale,
                      )}
                    />
                    <SmallMetric
                      icon={ReceiptText}
                      label={m.finance.overview.transactions}
                      value={formatCount(
                        summary.summary.transactionCount,
                        locale,
                      )}
                    />
                  </div>
                </div>
                <div className="px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {m.finance.trend.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.finance.trend.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                      {formatCount(summary.summary.paidOrderCount, locale)}{" "}
                      {m.finance.overview.paidOrders}
                    </span>
                  </div>
                  <div className="mt-5">
                    <FinanceTrendChart
                      currency={currency}
                      emptyLabel={m.finance.trend.empty}
                      grossLabel={m.finance.trend.grossCollected}
                      locale={locale}
                      netLabel={m.finance.trend.netCollected}
                      points={summary.dailyTrend}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid content-start gap-4">
              <Card className="rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {m.finance.position.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.finance.position.description}
                      </p>
                    </div>
                    <Icon
                      className="text-muted-foreground"
                      icon={CircleDollarSign}
                      size={18}
                    />
                  </div>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {m.finance.position.pendingRefunds}
                      </p>
                      <p className="mt-1.5 text-xl font-semibold tracking-tight">
                        {formatMoney(
                          summary.summary.pendingRefundAmount,
                          currency,
                          locale,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {interpolate(m.finance.position.pendingRefundCount, {
                          count: formatCount(
                            summary.summary.pendingRefundCount,
                            locale,
                          ),
                        })}
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        {m.finance.position.outstandingOrders}
                      </p>
                      <p className="mt-1.5 text-xl font-semibold tracking-tight">
                        {formatMoney(
                          summary.summary.outstandingOrderAmount,
                          currency,
                          locale,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {interpolate(m.finance.position.outstandingOrderCount, {
                          count: formatCount(
                            summary.summary.outstandingOrderCount,
                            locale,
                          ),
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold">
                    {m.finance.tools.title}
                  </h2>
                  <div className="mt-3 divide-y">
                    <Link
                      className="group flex items-center gap-3 py-3 first:pt-1"
                      href={webAdminRoutes.tenant.reports}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon icon={FileText} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">
                          {m.finance.tools.reports}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                          {m.finance.tools.reportsDescription}
                        </span>
                      </span>
                      <Icon
                        className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        icon={ArrowRight}
                        size={14}
                      />
                    </Link>
                    <Link
                      className="group flex items-center gap-3 py-3 last:pb-0"
                      href={webAdminRoutes.tenant.orders}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon icon={ReceiptText} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">
                          {m.finance.tools.orders}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                          {m.finance.tools.ordersDescription}
                        </span>
                      </span>
                      <Icon
                        className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        icon={ArrowRight}
                        size={14}
                      />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl">
            <CardContent className="p-5 sm:p-6">
              <div>
                <h2 className="text-sm font-semibold">
                  {m.finance.paymentMethods.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.finance.paymentMethods.description}
                </p>
              </div>
              {summary.paymentMethods.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {summary.paymentMethods.map((method) => {
                    const MethodIcon = paymentMethodIcon(method.method);
                    const share =
                      totalMethodNet === 0
                        ? 0
                        : Math.max(
                            0,
                            Math.min(
                              100,
                              (method.netCollected / totalMethodNet) * 100,
                            ),
                          );

                    return (
                      <div
                        className="rounded-lg border bg-muted/15 p-4"
                        key={method.method}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-medium">
                            <span className="flex size-7 items-center justify-center rounded-md bg-background">
                              <Icon icon={MethodIcon} size={14} />
                            </span>
                            {methodLabels[method.method]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatCount(method.transactionCount, locale)}{" "}
                            {m.finance.paymentMethods.transactions}
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-semibold tracking-tight">
                          {formatMoney(method.netCollected, currency, locale)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {m.finance.paymentMethods.net}
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <div className="mt-3 flex justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>
                            {m.finance.paymentMethods.gross}{" "}
                            {formatMoney(
                              method.grossCollected,
                              currency,
                              locale,
                            )}
                          </span>
                          <span>
                            {m.finance.paymentMethods.refunds}{" "}
                            {formatMoney(method.refundAmount, currency, locale)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 rounded-lg bg-muted/35 px-4 py-8 text-center text-xs text-muted-foreground">
                  {m.finance.paymentMethods.empty}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl">
            <CardContent className="p-0">
              <div className="px-5 py-5 sm:px-6">
                <h2 className="text-sm font-semibold">
                  {m.finance.branches.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.finance.branches.description}
                </p>
              </div>
              {summary.branchPerformance.length > 0 ? (
                <div className="overflow-x-auto border-t">
                  <DataTable
                    className="w-full text-left text-xs"
                    density="comfortable"
                  >
                    <TableHeader className="bg-muted/35 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <TableRow>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.branches.branch}
                        </TableHead>
                        <TableHead className="px-5 py-3 text-right font-medium">
                          {m.finance.branches.gross}
                        </TableHead>
                        <TableHead className="px-5 py-3 text-right font-medium">
                          {m.finance.branches.refunds}
                        </TableHead>
                        <TableHead className="px-5 py-3 text-right font-medium">
                          {m.finance.branches.net}
                        </TableHead>
                        <TableHead className="px-5 py-3 text-right font-medium">
                          {m.finance.branches.transactions}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {summary.branchPerformance.map((branch) => (
                        <TableRow
                          className="transition-colors hover:bg-muted/25"
                          key={branch.branchId}
                        >
                          <TableCell className="px-5 py-3.5">
                            <span className="flex items-center gap-2 font-medium">
                              <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                                <Icon icon={Building2} size={13} />
                              </span>
                              {branch.branchName}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right text-muted-foreground">
                            {formatMoney(
                              branch.grossCollected,
                              currency,
                              locale,
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right text-red-600">
                            {formatMoney(branch.refundAmount, currency, locale)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right font-semibold">
                            {formatMoney(branch.netCollected, currency, locale)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right text-muted-foreground">
                            {formatCount(branch.transactionCount, locale)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DataTable>
                </div>
              ) : (
                <p className="border-t px-5 py-10 text-center text-xs text-muted-foreground">
                  {m.finance.branches.empty}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-xl">
            <CardContent className="p-0">
              <div className="px-5 py-5 sm:px-6">
                <h2 className="text-sm font-semibold">
                  {m.finance.activity.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.finance.activity.description}
                </p>
              </div>
              {summary.recentTransactions.length > 0 ? (
                <div className="overflow-x-auto border-t">
                  <DataTable
                    className="w-full text-left text-xs"
                    density="comfortable"
                  >
                    <TableHeader className="bg-muted/35 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <TableRow>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.activity.date}
                        </TableHead>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.activity.transaction}
                        </TableHead>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.activity.branch}
                        </TableHead>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.activity.method}
                        </TableHead>
                        <TableHead className="px-5 py-3 font-medium">
                          {m.finance.activity.status}
                        </TableHead>
                        <TableHead className="px-5 py-3 text-right font-medium">
                          {m.finance.activity.amount}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {summary.recentTransactions.map((transaction) => (
                        <TableRow
                          className="transition-colors hover:bg-muted/25"
                          key={`${transaction.source}-${transaction.id}`}
                        >
                          <TableCell className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                            {formatTenantDateTime(
                              transaction.occurredAt,
                              locale,
                              summary.timezone,
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                                  transaction.direction === "credit"
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "bg-red-500/10 text-red-600",
                                )}
                              >
                                <Icon
                                  icon={
                                    transaction.direction === "credit"
                                      ? ArrowDownLeft
                                      : ArrowUpRight
                                  }
                                  size={13}
                                />
                              </span>
                              <span>
                                <span className="block font-medium">
                                  {kindLabels[transaction.kind]}
                                </span>
                                <span className="block max-w-36 truncate text-[10px] text-muted-foreground">
                                  {m.finance.activity.order}{" "}
                                  {transaction.orderId}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-44 truncate px-5 py-3.5 text-muted-foreground">
                            {transaction.branchName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                            {methodLabels[transaction.paymentMethod]}
                          </TableCell>
                          <TableCell className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-1 text-[10px] font-medium",
                                transaction.status === "refunded"
                                  ? "bg-amber-500/10 text-amber-700"
                                  : "bg-emerald-500/10 text-emerald-700",
                              )}
                            >
                              {statusLabels[transaction.status]}
                            </span>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-nowrap px-5 py-3.5 text-right font-semibold",
                              transaction.direction === "debit" &&
                                "text-red-600",
                            )}
                          >
                            {transaction.direction === "credit" ? "+" : "−"}
                            {formatMoney(
                              transaction.amount,
                              transaction.currency,
                              locale,
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DataTable>
                </div>
              ) : (
                <p className="border-t px-5 py-10 text-center text-xs text-muted-foreground">
                  {m.finance.activity.empty}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
