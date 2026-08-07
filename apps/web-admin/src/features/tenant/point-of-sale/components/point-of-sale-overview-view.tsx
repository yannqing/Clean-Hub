"use client";

import {
  Button,
  Card,
  CardContent,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@cleanhub/ui";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CircleDollarSign,
  HardDrive,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  SquareTerminal,
  UsersRound,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  pointOfSaleDatePresets,
  resolvePointOfSaleDatePreset,
  type PointOfSaleDatePresetId,
} from "../date-presets";
import type { PointOfSaleOverview, PointOfSaleOverviewQuery } from "../types";

type PointOfSaleOverviewViewProps = {
  defaultCurrency: string;
  error?: string;
  query: PointOfSaleOverviewQuery;
  selectedPreset: PointOfSaleDatePresetId;
  summary?: PointOfSaleOverview;
};

const ALL_BRANCHES_VALUE = "__all_branches__";

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTenantTime(
  value: string,
  locale: string,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon icon={icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-lg font-semibold tracking-tight">
          {value}
        </span>
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function PointOfSaleOverviewView({
  defaultCurrency,
  error,
  query,
  selectedPreset,
  summary,
}: PointOfSaleOverviewViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, m } = useTenantI18n();
  const [isPending, startTransition] = useTransition();
  const currency = summary?.currency ?? query.currency ?? defaultCurrency;

  function navigate(changes: Partial<PointOfSaleOverviewQuery>) {
    const values = { ...query, ...changes };
    const params = new URLSearchParams();

    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    if (values.branchId) params.set("branchId", values.branchId);
    if (values.currency) params.set("currency", values.currency);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function changeBranch(value: string) {
    if (value === ALL_BRANCHES_VALUE) {
      const next = { ...query };
      delete next.branchId;
      const params = new URLSearchParams();
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      if (next.currency) params.set("currency", next.currency);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
      return;
    }

    navigate({ branchId: value });
  }

  const quickLinks = [
    {
      description: m.pointOfSale.overview.quickLinks.devicesDescription,
      href: webAdminRoutes.tenant.pointOfSale.devices,
      icon: SquareTerminal,
      title: m.pointOfSale.overview.quickLinks.devices,
    },
    {
      description: m.pointOfSale.overview.quickLinks.sessionsDescription,
      href: webAdminRoutes.tenant.pointOfSale.registerSessions,
      icon: Banknote,
      title: m.pointOfSale.overview.quickLinks.sessions,
    },
    {
      description: m.pointOfSale.overview.quickLinks.hardwareDescription,
      href: webAdminRoutes.tenant.hardware,
      icon: Wrench,
      title: m.pointOfSale.overview.quickLinks.hardware,
    },
    {
      description: m.pointOfSale.overview.quickLinks.ordersDescription,
      href: webAdminRoutes.tenant.orders,
      icon: ShoppingBag,
      title: m.pointOfSale.overview.quickLinks.orders,
    },
    {
      description: m.pointOfSale.overview.quickLinks.financeDescription,
      href: webAdminRoutes.tenant.finance,
      icon: WalletCards,
      title: m.pointOfSale.overview.quickLinks.finance,
    },
  ];

  return (
    <div
      className={cn("space-y-5 transition-opacity", isPending && "opacity-60")}
    >
      <section className="overflow-hidden rounded-xl border bg-foreground text-background">
        <div className="flex flex-col justify-between gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background/10">
              <Icon icon={SquareTerminal} size={17} />
            </span>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-background/55">
                {m.pointOfSale.overview.noticeBadge}
              </span>
              <h2 className="mt-1 text-sm font-semibold">
                {m.pointOfSale.overview.noticeTitle}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-background/65">
                {m.pointOfSale.overview.noticeDescription}
              </p>
            </div>
          </div>
          {summary ? (
            <span className="shrink-0 text-[10px] text-background/50">
              {m.pointOfSale.updatedAt}{" "}
              {formatTenantTime(summary.generatedAt, locale, summary.timezone)}
            </span>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-b pb-4">
        <Select
          disabled={isPending}
          onValueChange={(value) =>
            navigate(
              resolvePointOfSaleDatePreset(
                value as PointOfSaleDatePresetId,
                new Date(),
                summary?.timezone ?? "UTC",
              ),
            )
          }
          value={selectedPreset}
        >
          <SelectTrigger
            aria-label={m.pointOfSale.filters.dateRange}
            className="h-8 min-w-[145px] bg-background text-xs"
            size="sm"
          >
            <Icon icon={CalendarDays} size={14} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {pointOfSaleDatePresets.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {m.pointOfSale.presets[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={isPending || !summary}
          onValueChange={changeBranch}
          value={query.branchId ?? ALL_BRANCHES_VALUE}
        >
          <SelectTrigger
            aria-label={m.pointOfSale.filters.branch}
            className="h-8 min-w-[145px] bg-background text-xs"
            size="sm"
          >
            <Icon icon={Building2} size={14} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_BRANCHES_VALUE}>
              {m.pointOfSale.filters.allBranches}
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
              aria-label={m.pointOfSale.filters.currency}
              className="h-8 min-w-[100px] bg-background text-xs"
              size="sm"
            >
              <Icon icon={WalletCards} size={14} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {summary.availableCurrencies.map((availableCurrency) => (
                <SelectItem key={availableCurrency} value={availableCurrency}>
                  {availableCurrency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium">
            {m.pointOfSale.overview.errorTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.pointOfSale.overview.errorDescription}
          </p>
        </div>
      ) : null}

      {summary ? (
        <>
          <section
            aria-label={m.pointOfSale.overview.metricsLabel}
            className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Metric
              icon={CircleDollarSign}
              label={m.pointOfSale.overview.metrics.grossSales}
              value={formatMoney(summary.metrics.grossSales, currency, locale)}
            />
            <Metric
              icon={PackageCheck}
              label={m.pointOfSale.overview.metrics.grossProfit}
              value={formatMoney(summary.metrics.grossProfit, currency, locale)}
            />
            <Metric
              icon={ReceiptText}
              label={m.pointOfSale.overview.metrics.orderCount}
              value={formatCount(summary.metrics.orderCount, locale)}
            />
            <Metric
              icon={HardDrive}
              label={m.pointOfSale.overview.metrics.registeredDevices}
              value={formatCount(summary.metrics.totalDevices, locale)}
            />
            <Metric
              icon={Banknote}
              label={m.pointOfSale.overview.metrics.openSessions}
              value={formatCount(summary.metrics.openSessions, locale)}
            />
            <Metric
              icon={Building2}
              label={m.pointOfSale.overview.metrics.activeBranches}
              value={formatCount(
                summary.availableBranches.filter(
                  (branch) => branch.status === "active",
                ).length,
                locale,
              )}
            />
          </section>

          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            {m.pointOfSale.overview.grossProfitCoverage}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
            <Card className="rounded-xl">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold">
                  {m.pointOfSale.overview.branchPerformance.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.pointOfSale.overview.branchPerformance.description}
                </p>
                {summary.branches.length > 0 ? (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {summary.branches.map((branch) => (
                      <div
                        className="rounded-lg border bg-muted/15 p-4"
                        key={branch.branchId}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background">
                              <Icon icon={Building2} size={13} />
                            </span>
                            <span className="truncate">
                              {branch.branchName}
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatCount(branch.totalDevices, locale)}{" "}
                            {m.pointOfSale.overview.branchPerformance.devices}
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-semibold tracking-tight">
                          {formatMoney(branch.grossSales, currency, locale)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {m.pointOfSale.overview.branchPerformance.grossSales}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-[10px]">
                          <span className="text-muted-foreground">
                            {m.pointOfSale.overview.branchPerformance.orders}
                            <strong className="ml-1 text-foreground">
                              {formatCount(branch.orderCount, locale)}
                            </strong>
                          </span>
                          <span className="text-right text-muted-foreground">
                            {
                              m.pointOfSale.overview.branchPerformance
                                .grossProfit
                            }
                            <strong className="ml-1 text-foreground">
                              {formatMoney(
                                branch.grossProfit,
                                currency,
                                locale,
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-muted/30 px-4 py-8 text-center text-xs text-muted-foreground">
                    {m.pointOfSale.overview.branchPerformance.empty}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid content-start gap-4">
              <Card className="rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">
                        {m.pointOfSale.overview.devices.title}
                      </h2>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {m.pointOfSale.overview.devices.description}
                      </p>
                    </div>
                    <Icon
                      className="text-muted-foreground"
                      icon={SquareTerminal}
                      size={17}
                    />
                  </div>
                  <div className="mt-4 divide-y">
                    <SummaryRow
                      label={m.pointOfSale.overview.devices.active}
                      value={formatCount(summary.deviceSummary.active, locale)}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.devices.inactive}
                      value={formatCount(
                        summary.deviceSummary.inactive,
                        locale,
                      )}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.devices.online}
                      value={formatCount(summary.deviceSummary.online, locale)}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.devices.offline}
                      value={formatCount(summary.deviceSummary.offline, locale)}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.devices.neverSeen}
                      value={formatCount(summary.deviceSummary.never, locale)}
                    />
                  </div>
                  <Button
                    asChild
                    className="mt-3 w-full"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={webAdminRoutes.tenant.pointOfSale.devices}>
                      {m.pointOfSale.overview.devices.action}
                      <Icon icon={ArrowRight} size={13} />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold">
                    {m.pointOfSale.overview.cashTracking.title}
                  </h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.pointOfSale.overview.cashTracking.description}
                  </p>
                  <div className="mt-3 divide-y">
                    <SummaryRow
                      label={m.pointOfSale.overview.cashTracking.expectedCash}
                      value={formatMoney(
                        summary.cashTracking.expectedCash,
                        currency,
                        locale,
                      )}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.cashTracking.countedCash}
                      value={formatMoney(
                        summary.cashTracking.countedCash,
                        currency,
                        locale,
                      )}
                    />
                    <SummaryRow
                      label={m.pointOfSale.overview.cashTracking.variance}
                      value={formatMoney(
                        summary.cashTracking.variance,
                        currency,
                        locale,
                      )}
                    />
                  </div>
                  <Button
                    asChild
                    className="mt-3 w-full"
                    size="sm"
                    variant="outline"
                  >
                    <Link
                      href={webAdminRoutes.tenant.pointOfSale.registerSessions}
                    >
                      {m.pointOfSale.overview.cashTracking.action}
                      <Icon icon={ArrowRight} size={13} />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      {m.pointOfSale.overview.staff.title}
                    </h2>
                    <Icon
                      className="text-muted-foreground"
                      icon={UsersRound}
                      size={17}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.pointOfSale.overview.staff.description}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      {
                        label: m.pointOfSale.overview.staff.onDuty,
                        value: summary.staffSummary.onDutyCount,
                      },
                      {
                        label: m.pointOfSale.overview.staff.onBreak,
                        value: summary.staffSummary.onBreakCount,
                      },
                      {
                        label: m.pointOfSale.overview.staff.offDuty,
                        value: summary.staffSummary.offDutyCount,
                      },
                    ].map((item) => (
                      <div
                        className="rounded-md bg-muted/50 px-2 py-2.5 text-center"
                        key={item.label}
                      >
                        <strong className="block text-base">
                          {formatCount(item.value, locale)}
                        </strong>
                        <span className="mt-0.5 block text-[9px] text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold">
                {m.pointOfSale.overview.quickLinks.title}
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {quickLinks.map((link) => (
                  <Link
                    className="group rounded-lg border bg-muted/10 p-3 transition-colors hover:bg-muted/40"
                    href={link.href}
                    key={link.href}
                  >
                    <span className="flex size-7 items-center justify-center rounded-md bg-background">
                      <Icon icon={link.icon} size={14} />
                    </span>
                    <span className="mt-3 block text-xs font-semibold">
                      {link.title}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                      {link.description}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
