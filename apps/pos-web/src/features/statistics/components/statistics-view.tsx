"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type PieSectorShapeProps,
  type SectorProps,
} from "recharts";

import type { PosStatisticsOverview } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cleanhub/ui";

import {
  Icon,
  PosBreadcrumb,
  PosPageHeader,
  type PosIconName,
} from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import {
  PosChartContainer,
  PosChartTooltip,
} from "@/components/charts/pos-chart";
import { formatPosMoney } from "@/lib/money";
import { posMessage } from "@/lib/pos-message";

type StatisticsViewProps = {
  overview: PosStatisticsOverview | null;
};

const CHART_COLORS = {
  orders: "var(--chart-1)",
  paid: "var(--chart-2)",
  tickets: "var(--chart-3)",
  customers: "var(--chart-4)",
  risk: "var(--chart-5)",
  muted: "var(--muted-foreground)",
} as const;

const TICKET_STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: CHART_COLORS.muted },
  pending: { label: "待处理", color: CHART_COLORS.risk },
  in_progress: { label: "处理中", color: CHART_COLORS.orders },
  ready_to_pick: { label: "待取件", color: CHART_COLORS.tickets },
  picked_up: { label: "已取件", color: CHART_COLORS.paid },
  cancelled: { label: "已取消", color: CHART_COLORS.muted },
  exception: { label: "异常", color: CHART_COLORS.risk },
  completed: { label: "已完成", color: CHART_COLORS.paid },
};

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

function formatTrimmedDecimal(
  value: number,
  maximumFractionDigits = 1,
): string {
  if (maximumFractionDigits === 0) {
    return String(Math.round(value));
  }

  const factor = 10 ** maximumFractionDigits;
  const rounded = Math.round(value * factor) / factor;

  return rounded
    .toFixed(maximumFractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatCompactCurrency(value: number, locale: string): string {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);

  if (locale === "zh-CN") {
    if (absoluteValue >= 10000) {
      return `${sign}¥${formatTrimmedDecimal(absoluteValue / 10000)}万`;
    }

    return `${sign}¥${formatTrimmedDecimal(absoluteValue, absoluteValue % 1 === 0 ? 0 : 1)}`;
  }

  if (absoluteValue >= 1000000) {
    return `${sign}¥${formatTrimmedDecimal(absoluteValue / 1000000)}M`;
  }

  if (absoluteValue >= 1000) {
    return `${sign}¥${formatTrimmedDecimal(absoluteValue / 1000)}K`;
  }

  return `${sign}¥${formatTrimmedDecimal(absoluteValue, absoluteValue % 1 === 0 ? 0 : 1)}`;
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value / 100);
}

function formatCountUnit(
  value: number,
  locale: string,
  zhUnit: string,
  enUnit: string,
  frUnit: string,
): string {
  const count = formatNumber(value, locale);

  if (locale === "en") {
    return `${count} ${enUnit}`;
  }

  if (locale === "fr") {
    return `${count} ${frUnit}`;
  }

  return `${count} ${zhUnit}`;
}

function MetricCard({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: PosIconName;
  label: string;
  value: string;
}) {
  return (
    <Card className="min-h-20 gap-0 py-0 shadow-none">
      <CardContent className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" name={icon} />
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold text-foreground">
              {value}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {helper}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: PosIconName;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" name={icon} />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function LegendRow({
  color,
  helper,
  label,
  value,
}: {
  color: string;
  helper?: string;
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
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {helper ? (
            <span className="block truncate text-xs text-muted-foreground">
              {helper}
            </span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 font-semibold text-foreground">{value}</span>
    </div>
  );
}

type VerticalChartDatum = {
  color: string;
  displayValue: string;
  label: string;
  shortLabel: string;
  value: number;
};

type CustomerTrendPoint = {
  date: string;
  count: number;
};

function ChartCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function formatShortDateLabel(date: string): string {
  const [, month = "", day = ""] = date.split("-");

  return month && day ? `${month}/${day}` : date;
}

function VerticalBarChart({
  ariaLabel,
  data,
  locale,
  maxValue,
  valueFormatter,
}: {
  ariaLabel: string;
  data: VerticalChartDatum[];
  locale: string;
  maxValue?: number;
  valueFormatter: (value: number, locale: string) => string;
}) {
  const chartMax = Math.max(
    maxValue ?? 0,
    ...data.map((item) => item.value),
    1,
  );

  return (
    <PosChartContainer className="mt-5 h-56">
      <BarChart
        aria-label={ariaLabel}
        data={data}
        margin={{ bottom: 8, left: 0, right: 12, top: 20 }}
      >
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey="shortLabel"
          tick={{
            fill: "var(--muted-foreground)",
            fontSize: 11,
            fontWeight: 500,
          }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={[0, chartMax]}
          tick={{
            fill: "var(--muted-foreground)",
            fontSize: 10,
            fontWeight: 500,
          }}
          tickFormatter={(value) => valueFormatter(Number(value), locale)}
          tickLine={false}
          width={48}
        />
        <Tooltip
          content={<PosChartTooltip hideLabel />}
          cursor={{ fill: "var(--muted)" }}
          isAnimationActive={false}
        />
        <Bar
          activeBar={{
            fillOpacity: 0.86,
            stroke: "var(--foreground)",
            strokeOpacity: 0.12,
          }}
          background={{ fill: "var(--muted)", radius: 8 }}
          dataKey="value"
          maxBarSize={46}
          minPointSize={4}
          radius={[8, 8, 4, 4]}
        >
          {data.map((item) => (
            <Cell fill={item.color} key={item.label} />
          ))}
        </Bar>
      </BarChart>
    </PosChartContainer>
  );
}

function CustomerTrendChart({
  data,
  locale,
}: {
  data: CustomerTrendPoint[];
  locale: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const chartData = data.map((item) => ({
    color: CHART_COLORS.customers,
    displayValue: formatNumber(item.count, locale),
    label: item.date,
    shortLabel: formatShortDateLabel(item.date),
    value: item.count,
  }));

  return (
    <PosChartContainer className="mt-4 h-44">
      <LineChart
        aria-label="近 7 天新增客户趋势"
        data={chartData}
        margin={{ bottom: 8, left: 0, right: 18, top: 12 }}
      >
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey="shortLabel"
          tick={{
            fill: "var(--muted-foreground)",
            fontSize: 10,
            fontWeight: 500,
          }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={[0, Math.ceil(maxValue)]}
          tick={{
            fill: "var(--muted-foreground)",
            fontSize: 10,
            fontWeight: 500,
          }}
          tickFormatter={(value) => formatNumber(Number(value), locale)}
          tickLine={false}
          width={36}
        />
        <Tooltip
          content={<PosChartTooltip hideLabel />}
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          isAnimationActive={false}
        />
        <Line
          activeDot={{
            fill: "var(--chart-4)",
            r: 6,
            stroke: "var(--background)",
            strokeWidth: 3,
          }}
          dataKey="value"
          dot={{
            fill: "var(--chart-4)",
            r: 3,
            stroke: "var(--background)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
          stroke="var(--chart-4)"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </PosChartContainer>
  );
}

function RevenueComparisonChart({
  locale,
  paidAmount,
  paidPercent,
  totalAmount,
}: {
  locale: string;
  paidAmount: number;
  paidPercent: number;
  totalAmount: number;
}) {
  const unpaidAmount = Math.max(totalAmount - paidAmount, 0);
  const data: VerticalChartDatum[] = [
    {
      color: CHART_COLORS.orders,
      displayValue: formatCompactCurrency(totalAmount, locale),
      label: posMessage("pos.chart.salesToday"),
      shortLabel: posMessage("pos.chart.salesShort"),
      value: totalAmount,
    },
    {
      color: CHART_COLORS.paid,
      displayValue: formatCompactCurrency(paidAmount, locale),
      label: posMessage("pos.chart.collected"),
      shortLabel: posMessage("pos.chart.collectedShort"),
      value: paidAmount,
    },
    {
      color: CHART_COLORS.muted,
      displayValue: formatCompactCurrency(unpaidAmount, locale),
      label: posMessage("pos.chart.outstanding"),
      shortLabel: posMessage("pos.chart.outstandingShort"),
      value: unpaidAmount,
    },
  ];

  return (
    <ChartCard
      description="今日销售额、已收金额与未收金额对比"
      title="收款对比图"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
        <VerticalBarChart
          ariaLabel="今日收款对比图"
          data={data}
          locale={locale}
          maxValue={totalAmount}
          valueFormatter={formatCompactCurrency}
        />

        <div className="flex flex-col justify-center gap-3">
          <div className="rounded-md bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              收款完成率
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {formatPercent(paidPercent, locale)}
            </p>
          </div>
          {data.map((item) => (
            <LegendRow
              color={item.color}
              key={item.label}
              label={item.label}
              value={item.displayValue}
            />
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

function OrderStructureChart({
  cancelledCount,
  deliveredCount,
  locale,
  orderCount,
  unpaidCount,
}: {
  cancelledCount: number;
  deliveredCount: number;
  locale: string;
  orderCount: number;
  unpaidCount: number;
}) {
  const data: VerticalChartDatum[] = [
    {
      color: CHART_COLORS.orders,
      displayValue: formatNumber(orderCount, locale),
      label: posMessage("pos.chart.ordersToday"),
      shortLabel: posMessage("pos.chart.ordersShort"),
      value: orderCount,
    },
    {
      color: CHART_COLORS.paid,
      displayValue: formatNumber(deliveredCount, locale),
      label: posMessage("pos.chart.completedOrders"),
      shortLabel: posMessage("pos.chart.completedShort"),
      value: deliveredCount,
    },
    {
      color: CHART_COLORS.risk,
      displayValue: formatNumber(unpaidCount, locale),
      label: posMessage("pos.chart.unpaidOrders"),
      shortLabel: posMessage("pos.chart.unpaidShort"),
      value: unpaidCount,
    },
    {
      color: CHART_COLORS.muted,
      displayValue: formatNumber(cancelledCount, locale),
      label: posMessage("pos.chart.cancelledOrders"),
      shortLabel: posMessage("pos.chart.cancelledShort"),
      value: cancelledCount,
    },
  ];

  return (
    <ChartCard description="今日订单完成、取消与待收款情况" title="订单构成图">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
        <VerticalBarChart
          ariaLabel="今日订单构成图"
          data={data}
          locale={locale}
          valueFormatter={formatNumber}
        />
        <div className="flex flex-col justify-center gap-3">
          {data.map((item) => (
            <LegendRow
              color={item.color}
              key={item.label}
              label={item.label}
              value={formatCountUnit(
                item.value,
                locale,
                "单",
                "orders",
                "commandes",
              )}
            />
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

function DonutSectorShape(props: PieSectorShapeProps) {
  const {
    className,
    cursor,
    cx,
    cy,
    endAngle,
    fill,
    fillOpacity,
    innerRadius,
    isActive,
    outerRadius,
    startAngle,
  } = props;
  const adjustedOuterRadius = outerRadius + (isActive ? 10 : 0);
  const adjustedInnerRadius = Math.max(innerRadius - (isActive ? 2 : 0), 0);
  const sectorProps: SectorProps = {
    className,
    cornerRadius: isActive ? 10 : 7,
    cursor,
    cx,
    cy,
    endAngle,
    fill,
    fillOpacity,
    forceCornerRadius: true,
    innerRadius: adjustedInnerRadius,
    outerRadius: adjustedOuterRadius,
    startAngle,
    stroke: "var(--background)",
    strokeWidth: isActive ? 4 : 3,
    style: {
      transition: "fill-opacity 150ms ease, filter 150ms ease",
    },
  };

  return (
    <g>
      <Sector {...sectorProps} />
      {isActive ? (
        <Sector
          cornerRadius={12}
          cx={cx}
          cy={cy}
          endAngle={endAngle}
          fill={fill}
          fillOpacity={0.16}
          forceCornerRadius
          innerRadius={adjustedOuterRadius + 4}
          outerRadius={adjustedOuterRadius + 7}
          startAngle={startAngle}
          stroke="none"
        />
      ) : null}
    </g>
  );
}

function DonutChart({
  ariaLabel,
  centerLabel,
  centerValue,
  data,
  locale,
  valueFormatter = String,
}: {
  ariaLabel: string;
  centerLabel: string;
  centerValue: string;
  data: Array<{
    color: string;
    label: string;
    value: number;
  }>;
  locale: string;
  valueFormatter?: (value: number) => string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData =
    total > 0
      ? data.map((item) => ({
          ...item,
          displayValue: valueFormatter(item.value),
          helper: formatPercent((item.value / total) * 100, locale),
        }))
      : [
          {
            color: "var(--muted)",
            displayValue: valueFormatter(0),
            helper: undefined,
            label: posMessage("pos.chart.noData"),
            value: 1,
          },
        ];
  const activeItem =
    activeIndex === undefined ? undefined : chartData[activeIndex];
  const displayCenterLabel = activeItem?.label ?? centerLabel;
  const displayCenterValue = activeItem?.displayValue ?? centerValue;

  return (
    <div className="relative">
      <PosChartContainer className="h-56">
        <PieChart aria-label={ariaLabel}>
          <Tooltip
            content={<PosChartTooltip hideLabel />}
            cursor={false}
            isAnimationActive={false}
          />
          <Pie
            data={chartData}
            dataKey="value"
            endAngle={-270}
            innerRadius={50}
            isAnimationActive={false}
            nameKey="label"
            onClick={(_, index) => {
              setActiveIndex(index);
            }}
            onMouseEnter={(_, index) => {
              setActiveIndex(index);
            }}
            onMouseLeave={() => {
              setActiveIndex(undefined);
            }}
            onTouchStart={(_, index) => {
              setActiveIndex(index);
            }}
            outerRadius={74}
            paddingAngle={total > 0 ? 3 : 0}
            shape={DonutSectorShape}
            startAngle={90}
            stroke="var(--background)"
            strokeWidth={3}
          >
            {chartData.map((item, index) => (
              <Cell
                className="outline-none transition-opacity duration-150"
                cursor={total > 0 ? "pointer" : "default"}
                fill={item.color}
                fillOpacity={
                  activeIndex === undefined || activeIndex === index ? 1 : 0.32
                }
                key={item.label}
              />
            ))}
          </Pie>
        </PieChart>
      </PosChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground transition-colors duration-150">
          {displayCenterValue}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">
          {displayCenterLabel}
        </span>
        {activeItem?.helper ? (
          <span className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            {activeItem.helper}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BusinessStructureChart({
  locale,
  ticketEntries,
  ticketTotal,
  todayNewCustomerCount,
  totalCustomerCount,
}: {
  locale: string;
  ticketEntries: Array<[string, number]>;
  ticketTotal: number;
  todayNewCustomerCount: number;
  totalCustomerCount: number;
}) {
  const ticketChartData = ticketEntries.map(([status, count]) => {
    const meta = TICKET_STATUS_META[status] ?? {
      label: status,
      color: CHART_COLORS.tickets,
    };

    return {
      color: meta.color,
      label: meta.label,
      value: count,
    };
  });
  const existingCustomerCount = Math.max(
    totalCustomerCount - todayNewCustomerCount,
    0,
  );
  const newCustomerPercent =
    totalCustomerCount > 0
      ? clampPercent((todayNewCustomerCount / totalCustomerCount) * 100)
      : 0;
  const customerChartData = [
    {
      color: CHART_COLORS.customers,
      label: posMessage("pos.chart.existingCustomers"),
      value: existingCustomerCount,
    },
    {
      color: CHART_COLORS.paid,
      label: posMessage("pos.chart.newCustomersToday"),
      value: todayNewCustomerCount,
    },
  ];

  return (
    <ChartCard
      description="工单状态和客户增长集中展示"
      title="工单与客户结构图"
    >
      <div className="mt-5 grid gap-8 xl:grid-cols-2">
        <div className="min-w-0">
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              工单状态图
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              当前工单池按状态拆分
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
            <DonutChart
              ariaLabel="工单状态分布图"
              centerLabel="全部工单"
              centerValue={formatNumber(ticketTotal, locale)}
              data={ticketChartData}
              locale={locale}
              valueFormatter={(value) => formatNumber(value, locale)}
            />

            <div className="flex flex-col justify-center gap-3">
              {ticketChartData.length > 0 ? (
                ticketChartData.map((item) => {
                  const percentage =
                    ticketTotal > 0
                      ? clampPercent((item.value / ticketTotal) * 100)
                      : 0;

                  return (
                    <LegendRow
                      color={item.color}
                      helper={formatPercent(percentage, locale)}
                      key={item.label}
                      label={item.label}
                      value={formatNumber(item.value, locale)}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">暂无工单数据</p>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 xl:border-l xl:pl-8">
          <div>
            <h4 className="text-xs font-semibold text-foreground">
              客户增长图
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              客户存量与今日新增
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
            <DonutChart
              ariaLabel="客户增长占比图"
              centerLabel="客户总数"
              centerValue={formatNumber(totalCustomerCount, locale)}
              data={customerChartData}
              locale={locale}
              valueFormatter={(value) => formatNumber(value, locale)}
            />

            <div className="flex flex-col justify-center gap-3">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    新增客户占比
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPercent(newCustomerPercent, locale)}
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS.paid,
                      width: `${newCustomerPercent}%`,
                    }}
                  />
                </div>
              </div>
              {customerChartData.map((item) => (
                <LegendRow
                  color={item.color}
                  key={item.label}
                  label={item.label}
                  value={formatNumber(item.value, locale)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function CustomerPanel({
  customers,
  locale,
}: {
  customers: PosStatisticsOverview["customers"];
  locale: string;
}) {
  const totalCount = toNumber(customers.totalCount);
  const todayNewCount = toNumber(customers.todayNewCount);
  const activeCount = toNumber(customers.activeCount);
  const disabledCount = toNumber(customers.disabledCount);
  const profileCount = toNumber(customers.profileCount);
  const activeProfileCount = toNumber(customers.activeProfileCount);
  const disabledProfileCount = toNumber(customers.disabledProfileCount);
  const todayNewProfileCount = toNumber(customers.todayNewProfileCount);
  const orderedCustomerCount = toNumber(customers.orderedCustomerCount);
  const ticketedCustomerCount = toNumber(customers.ticketedCustomerCount);
  const engagedCustomerCount = toNumber(customers.engagedCustomerCount);
  const repeatOrderCustomerCount = toNumber(customers.repeatOrderCustomerCount);
  const repeatTicketCustomerCount = toNumber(
    customers.repeatTicketCustomerCount,
  );
  const activeAccountPercent =
    totalCount > 0 ? clampPercent((activeCount / totalCount) * 100) : 0;
  const activeProfilePercent =
    profileCount > 0
      ? clampPercent((activeProfileCount / profileCount) * 100)
      : 0;
  const engagementPercent =
    profileCount > 0
      ? clampPercent((engagedCustomerCount / profileCount) * 100)
      : 0;
  const repeatOrderPercent =
    orderedCustomerCount > 0
      ? clampPercent((repeatOrderCustomerCount / orderedCustomerCount) * 100)
      : 0;
  const trendData = customers.sevenDayNewAccounts.map((item) => ({
    date: item.date,
    count: toNumber(item.count),
  }));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="grid gap-1.5">
          <CardTitle className="text-sm">客户运营概览</CardTitle>
          <CardDescription className="text-xs">
            账户、档案、服务参与度与新增趋势
          </CardDescription>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" name="users" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="gap-0 bg-muted/30 py-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    客户账户
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatNumber(totalCount, locale)}
                  </p>
                </div>
                <Badge variant="secondary">
                  今日 +{formatNumber(todayNewCount, locale)}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>启用账户</span>
                  <span>{formatPercent(activeAccountPercent, locale)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS.customers,
                      width: `${activeAccountPercent}%`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">启用</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(activeCount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">停用</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(disabledCount, locale)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 bg-muted/30 py-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    客户档案
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatNumber(profileCount, locale)}
                  </p>
                </div>
                <Badge variant="secondary">
                  今日 +{formatNumber(todayNewProfileCount, locale)}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>可服务档案</span>
                  <span>{formatPercent(activeProfilePercent, locale)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS.paid,
                      width: `${activeProfilePercent}%`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">启用档案</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(activeProfileCount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">停用档案</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(disabledProfileCount, locale)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 bg-muted/30 py-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    服务参与客户
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatNumber(engagedCustomerCount, locale)}
                  </p>
                </div>
                <Badge variant="secondary">
                  {formatPercent(engagementPercent, locale)}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">有订单</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(orderedCustomerCount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">有工单</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(ticketedCustomerCount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">复购客户</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(repeatOrderCustomerCount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">多次工单</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatNumber(repeatTicketCustomerCount, locale)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>订单复购率</span>
                  <span>{formatPercent(repeatOrderPercent, locale)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS.risk,
                      width: `${repeatOrderPercent}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 gap-0 bg-muted/30 py-0 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-foreground">
                  近 7 天新增客户
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  按客户账户创建日期统计
                </p>
              </div>
              <Badge variant="secondary">
                {formatCountUnit(
                  trendData.reduce((sum, item) => sum + item.count, 0),
                  locale,
                  "个账户",
                  "accounts",
                  "comptes",
                )}
              </Badge>
            </div>
            <CustomerTrendChart data={trendData} locale={locale} />
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="space-y-7 pb-8">
      <PosBreadcrumb items={[{ label: "统计数据" }]} />
      <PosPageHeader
        description="查看门店经营数据：订单、工单和客户统计。"
        icon="chart"
        title="统计数据"
      />
      <Card className="border-dashed shadow-none">
        <CardContent className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-6 w-6" name="chart" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            还没有可展示的统计信息
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            产生订单或工单后，这里会显示经营概况。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatisticsView({ overview }: StatisticsViewProps) {
  const { locale } = useTranslation();
  const { currency } = usePosRuntimeConfig();

  if (!overview) {
    return <EmptyState />;
  }

  const { customers, orders, tickets } = overview;
  const orderCount = toNumber(orders.orderCount);
  const totalAmount = toNumber(orders.totalAmount);
  const paidAmount = toNumber(orders.paidAmount);
  const unpaidCount = toNumber(orders.unpaidCount);
  const deliveredCount = toNumber(orders.deliveredCount);
  const cancelledCount = toNumber(orders.cancelledCount);
  const paidPercent =
    totalAmount > 0 ? clampPercent((paidAmount / totalAmount) * 100) : 0;
  const ticketStatusEntries = Object.entries(tickets.byStatus)
    .filter(([, count]) => toNumber(count) > 0)
    .map(([status, count]) => [status, toNumber(count)] as [string, number]);
  const ticketTotal = ticketStatusEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  const totalTicketCount = toNumber(tickets.total);
  const overdueCount = toNumber(tickets.overdueCount);
  const todayCreatedCount = toNumber(tickets.todayCreatedCount);
  const todayPickedUpCount = toNumber(tickets.todayPickedUpCount);
  const totalCustomerCount = toNumber(customers.totalCount);
  const todayNewCustomerCount = toNumber(customers.todayNewCount);

  return (
    <div className="space-y-7 pb-8">
      <PosBreadcrumb items={[{ label: "统计数据" }]} />
      <PosPageHeader
        actions={
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <Card className="gap-0 py-0 text-right shadow-none">
              <CardContent className="px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  今日销售额
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                  {formatCurrency(totalAmount, locale, currency)}
                </p>
              </CardContent>
            </Card>
            <Card className="gap-0 py-0 text-right shadow-none">
              <CardContent className="px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  收款完成率
                </p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatPercent(paidPercent, locale)}
                </p>
              </CardContent>
            </Card>
          </div>
        }
        description="查看门店经营数据：订单、工单和客户统计。"
        icon="chart"
        title="统计数据"
      />

      <section className="space-y-4">
        <SectionHeader
          description="今日订单与收款概况"
          icon="receipt"
          title="订单统计"
          action={
            <Badge className="h-8 px-3" variant="outline">
              {formatCountUnit(orderCount, locale, "单", "orders", "commandes")}
            </Badge>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            helper="今日全部订单"
            icon="receipt"
            label="今日订单数"
            value={formatNumber(orderCount, locale)}
          />
          <MetricCard
            helper={posMessage("pos.inline.collectedAmountHelper", {
              value: formatCurrency(paidAmount, locale, currency),
            })}
            icon="wallet-cards"
            label="今日销售额"
            value={formatCurrency(totalAmount, locale, currency)}
          />
          <MetricCard
            helper="未支付与部分支付"
            icon="clock"
            label="待收款订单"
            value={formatNumber(unpaidCount, locale)}
          />
          <MetricCard
            helper="已交付给客户"
            icon="package-check"
            label="已完成订单"
            value={formatNumber(deliveredCount, locale)}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <RevenueComparisonChart
            locale={locale}
            paidAmount={paidAmount}
            paidPercent={paidPercent}
            totalAmount={totalAmount}
          />
          <OrderStructureChart
            cancelledCount={cancelledCount}
            deliveredCount={deliveredCount}
            locale={locale}
            orderCount={orderCount}
            unpaidCount={unpaidCount}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          description="当前工单池与今日流转概况"
          icon="clipboard-list"
          title="工单统计"
          action={
            <Badge className="h-8 px-3" variant="outline">
              {formatCountUnit(
                totalTicketCount,
                locale,
                "个工单",
                "tickets",
                "tickets",
              )}
            </Badge>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            helper="当前全部工单"
            icon="clipboard-list"
            label="工单总数"
            value={formatNumber(totalTicketCount, locale)}
          />
          <MetricCard
            helper="超过预计取件时间"
            icon="alert"
            label="已逾期"
            value={formatNumber(overdueCount, locale)}
          />
          <MetricCard
            helper="今日创建的工单"
            icon="plus"
            label="今日新增"
            value={formatNumber(todayCreatedCount, locale)}
          />
          <MetricCard
            helper="今日已取件"
            icon="package-check"
            label="今日取件"
            value={formatNumber(todayPickedUpCount, locale)}
          />
        </div>

        <BusinessStructureChart
          locale={locale}
          ticketEntries={ticketStatusEntries}
          ticketTotal={ticketTotal}
          todayNewCustomerCount={todayNewCustomerCount}
          totalCustomerCount={totalCustomerCount}
        />
      </section>

      <section className="space-y-4">
        <SectionHeader
          description="客户存量与新增"
          icon="users"
          title="客户统计"
        />
        <CustomerPanel customers={customers} locale={locale} />
      </section>
    </div>
  );
}
