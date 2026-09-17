"use client";

import type { CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PosWorkspaceStatistics } from "@cleanhub/api-client";
import {
  createTranslator,
  defaultLocale,
  normalizeLocale,
} from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon, type PosIconName } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import {
  PosChartContainer,
  PosChartTooltip,
} from "@/components/charts/pos-chart";
import { formatPosMoney } from "@/lib/money";
import { posMessage } from "@/lib/pos-message";

type WorkspaceStatisticsProps = {
  statistics: PosWorkspaceStatistics | null;
};

const CHART_COLORS = {
  orders: "var(--chart-1)",
  paid: "var(--chart-2)",
  tickets: "var(--chart-3)",
  customers: "var(--chart-4)",
  overdue: "var(--chart-5)",
} as const;

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(
  value: number,
  locale: string,
  currency: string,
): string {
  return formatPosMoney(value, currency, locale);
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value / 100);
}

function formatOrderUnitCount(count: number, locale: string): string {
  return createTranslator({ locale: normalizeLocale(locale) ?? defaultLocale })(
    "pos.inline.orderCount",
    { count },
  );
}

function iconAccentStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 12%, white)`,
    borderColor: `color-mix(in oklch, ${color} 22%, white)`,
    color,
  };
}

function KpiCard({
  helper,
  icon,
  label,
  value,
  color,
}: {
  helper: string;
  icon: PosIconName;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <article className="rounded-md border border-border bg-background px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-foreground">
            {value}
          </p>
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={iconAccentStyle(color)}
        >
          <Icon className="h-4 w-4" name={icon} />
        </span>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
        {helper}
      </p>
    </article>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-semibold text-foreground">{value}</span>
    </div>
  );
}

function PaymentChart({
  currency,
  locale,
  orderCount,
  paidAmount,
  paidPercent,
  totalAmount,
  unpaidCount,
}: {
  currency: string;
  locale: string;
  orderCount: number;
  paidAmount: number;
  paidPercent: number;
  totalAmount: number;
  unpaidCount: number;
}) {
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0);
  const percentLabel = formatPercent(paidPercent, locale);
  const chartData =
    totalAmount > 0
      ? [
          {
            color: CHART_COLORS.paid,
            displayValue: formatCurrency(paidAmount, locale, currency),
            helper: percentLabel,
            label: posMessage("pos.chart.paidLabel"),
            value: paidAmount,
          },
          {
            color: "#cbd5e1",
            displayValue: formatCurrency(unpaidAmount, locale, currency),
            helper: posMessage("pos.inline.unpaidOrdersHelper", {
              value: formatOrderUnitCount(unpaidCount, locale),
            }),
            label: posMessage("pos.chart.unpaidLabel"),
            value: unpaidAmount,
          },
        ]
      : [
          {
            color: "#e2e8f0",
            displayValue: formatCurrency(0, locale, currency),
            label: posMessage("pos.chart.noPayments"),
            value: 1,
          },
        ];

  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">订单收款</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            销售额与实收金额对比
          </p>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {formatOrderUnitCount(orderCount, locale)}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-32 w-32 shrink-0">
          <PosChartContainer className="h-32">
            <PieChart>
              <Tooltip
                content={<PosChartTooltip hideLabel />}
                cursor={false}
                isAnimationActive={false}
              />
              <Pie
                activeShape={{ outerRadius: 62 }}
                data={chartData}
                dataKey="value"
                endAngle={-270}
                innerRadius="62%"
                isAnimationActive={false}
                nameKey="label"
                outerRadius="86%"
                paddingAngle={totalAmount > 0 ? 2 : 0}
                startAngle={90}
                stroke="#fff"
                strokeWidth={3}
              >
                {chartData.map((item) => (
                  <Cell fill={item.color} key={item.label} />
                ))}
              </Pie>
            </PieChart>
          </PosChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {percentLabel}
            </span>
            <span className="mt-0.5 text-xs font-medium text-muted-foreground">
              实收占比
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <LegendRow
            color={CHART_COLORS.paid}
            label="已收款"
            value={formatCurrency(paidAmount, locale, currency)}
          />
          <LegendRow
            color="#cbd5e1"
            label="待收款"
            value={formatCurrency(unpaidAmount, locale, currency)}
          />
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            未付款订单 {formatOrderUnitCount(unpaidCount, locale)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TicketBars({
  locale,
  overdueCount,
  todayCreatedCount,
  todayPickedUpCount,
  total,
}: {
  locale: string;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
  total: number;
}) {
  const bars = [
    {
      color: CHART_COLORS.orders,
      displayValue: formatNumber(todayCreatedCount, locale),
      helper:
        total > 0
          ? formatPercent((todayCreatedCount / total) * 100, locale)
          : "0%",
      label: posMessage("pos.chart.createdToday"),
      value: todayCreatedCount,
    },
    {
      color: CHART_COLORS.paid,
      displayValue: formatNumber(todayPickedUpCount, locale),
      helper:
        total > 0
          ? formatPercent((todayPickedUpCount / total) * 100, locale)
          : "0%",
      label: posMessage("pos.chart.pickedUpToday"),
      value: todayPickedUpCount,
    },
    {
      color: CHART_COLORS.overdue,
      displayValue: formatNumber(overdueCount, locale),
      helper:
        total > 0 ? formatPercent((overdueCount / total) * 100, locale) : "0%",
      label: posMessage("pos.chart.overdueTickets"),
      value: overdueCount,
    },
  ];
  const maxValue = Math.max(...bars.map((item) => item.value), 1);

  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">工单动态</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            今日创建、取件与逾期情况
          </p>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          共 {formatNumber(total, locale)}
        </span>
      </div>

      <PosChartContainer className="mt-5 h-44">
        <BarChart
          data={bars}
          layout="vertical"
          margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
          <XAxis domain={[0, maxValue]} hide type="number" />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
            tickLine={false}
            type="category"
            width={72}
          />
          <Tooltip
            content={<PosChartTooltip hideLabel />}
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            isAnimationActive={false}
          />
          <Bar
            activeBar={{
              fillOpacity: 0.86,
              stroke: "#0f172a",
              strokeOpacity: 0.12,
            }}
            background={{ fill: "#f1f5f9", radius: 8 }}
            dataKey="value"
            maxBarSize={18}
            minPointSize={4}
            radius={[0, 8, 8, 0]}
          >
            {bars.map((item) => (
              <Cell fill={item.color} key={item.label} />
            ))}
          </Bar>
        </BarChart>
      </PosChartContainer>
    </section>
  );
}

function CustomerGrowth({
  locale,
  todayNewCount,
  totalCount,
}: {
  locale: string;
  todayNewCount: number;
  totalCount: number;
}) {
  const newCustomerPercent =
    totalCount > 0 ? clampPercent((todayNewCount / totalCount) * 100) : 0;
  const existingCount = Math.max(totalCount - todayNewCount, 0);
  const chartData =
    totalCount > 0
      ? [
          {
            color: CHART_COLORS.customers,
            displayValue: formatNumber(existingCount, locale),
            helper: formatPercent(100 - newCustomerPercent, locale),
            label: posMessage("pos.chart.existingCustomers"),
            value: existingCount,
          },
          {
            color: CHART_COLORS.paid,
            displayValue: formatNumber(todayNewCount, locale),
            helper: formatPercent(newCustomerPercent, locale),
            label: posMessage("pos.chart.newToday"),
            value: todayNewCount,
          },
        ]
      : [
          {
            color: "#e2e8f0",
            displayValue: formatNumber(0, locale),
            label: posMessage("pos.chart.noCustomers"),
            value: 1,
          },
        ];

  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">客户增长</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            客户存量与今日新增
          </p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={iconAccentStyle(CHART_COLORS.customers)}
        >
          <Icon className="h-4 w-4" name="users" />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">总客户</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatNumber(totalCount, locale)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">今日新增</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatNumber(todayNewCount, locale)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>新增占比</span>
          <span>{formatPercent(newCustomerPercent, locale)}</span>
        </div>
        <div className="relative mt-3 h-28">
          <PosChartContainer className="h-28">
            <PieChart>
              <Tooltip
                content={<PosChartTooltip hideLabel />}
                cursor={false}
                isAnimationActive={false}
              />
              <Pie
                activeShape={{ outerRadius: 52 }}
                data={chartData}
                dataKey="value"
                endAngle={-270}
                innerRadius="58%"
                isAnimationActive={false}
                nameKey="label"
                outerRadius="84%"
                paddingAngle={totalCount > 0 ? 2 : 0}
                startAngle={90}
                stroke="#fff"
                strokeWidth={3}
              >
                {chartData.map((item) => (
                  <Cell fill={item.color} key={item.label} />
                ))}
              </Pie>
            </PieChart>
          </PosChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">
              {formatPercent(newCustomerPercent, locale)}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              新增占比
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WorkspaceStatistics({ statistics }: WorkspaceStatisticsProps) {
  const { locale } = useTranslation();
  const { currency } = usePosRuntimeConfig();

  if (!statistics) {
    return null;
  }

  const { customers, orders, tickets } = statistics;
  const orderCount = toNumber(orders.orderCount);
  const totalAmount = toNumber(orders.totalAmount);
  const paidAmount = toNumber(orders.paidAmount);
  const unpaidCount = toNumber(orders.unpaidCount);
  const paidPercent =
    totalAmount > 0 ? clampPercent((paidAmount / totalAmount) * 100) : 0;
  const ticketTotal = toNumber(tickets.total);
  const todayCreatedCount = toNumber(tickets.todayCreatedCount);
  const todayPickedUpCount = toNumber(tickets.todayPickedUpCount);
  const overdueCount = toNumber(tickets.overdueCount);
  const totalCustomerCount = toNumber(customers.totalCount);
  const todayNewCustomerCount = toNumber(customers.todayNewCount);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" name="chart" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">今日概况</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              订单、收款、工单与客户的实时概览
            </p>
          </div>
        </div>
        <span className="inline-flex h-8 items-center gap-2 rounded-md bg-muted px-3 text-xs font-semibold text-muted-foreground">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: CHART_COLORS.paid }}
          />
          实时数据
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          color={CHART_COLORS.orders}
          helper={posMessage("pos.inline.collectedHelper", {
            value: formatCurrency(paidAmount, locale, currency),
          })}
          icon="receipt"
          label="订单数"
          value={formatNumber(orderCount, locale)}
        />
        <KpiCard
          color={CHART_COLORS.paid}
          helper={posMessage("pos.inline.collectedShareHelper", {
            value: formatPercent(paidPercent, locale),
          })}
          icon="wallet-cards"
          label="销售额"
          value={formatCurrency(totalAmount, locale, currency)}
        />
        <KpiCard
          color={CHART_COLORS.tickets}
          helper={posMessage("pos.inline.pickedUpTodayHelper", {
            value: formatNumber(todayPickedUpCount, locale),
          })}
          icon="clipboard-list"
          label="工单数"
          value={formatNumber(ticketTotal, locale)}
        />
        <KpiCard
          color={CHART_COLORS.customers}
          helper={posMessage("pos.inline.totalCustomersHelper", {
            value: formatNumber(totalCustomerCount, locale),
          })}
          icon="user-plus"
          label="新增客户"
          value={formatNumber(todayNewCustomerCount, locale)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <PaymentChart
          currency={currency}
          locale={locale}
          orderCount={orderCount}
          paidAmount={paidAmount}
          paidPercent={paidPercent}
          totalAmount={totalAmount}
          unpaidCount={unpaidCount}
        />
        <TicketBars
          locale={locale}
          overdueCount={overdueCount}
          todayCreatedCount={todayCreatedCount}
          todayPickedUpCount={todayPickedUpCount}
          total={ticketTotal}
        />
        <CustomerGrowth
          locale={locale}
          todayNewCount={todayNewCustomerCount}
          totalCount={totalCustomerCount}
        />
      </div>
    </section>
  );
}
