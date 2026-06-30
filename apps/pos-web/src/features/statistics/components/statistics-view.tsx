"use client";

import type { PosStatisticsOverview } from "@cleanhub/api-client";
import { Icon, type PosIconName } from "@/components/app-shell/icons";

type StatisticsViewProps = {
  overview: PosStatisticsOverview | null;
};

type AccentColor = "blue" | "green" | "orange" | "red" | "purple" | "indigo";

/**
 * 色彩主题：与工作台模块共享同一套语义化配色。
 * 渐变条用于卡片顶部装饰与进度条，保证两个模块视觉统一。
 */
const ACCENT_THEME: Record<
  AccentColor,
  { iconBg: string; iconText: string; bar: string; ring: string }
> = {
  blue: {
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    bar: "bg-gradient-to-r from-blue-500 to-sky-500",
    ring: "ring-blue-100",
  },
  green: {
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    ring: "ring-emerald-100",
  },
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    bar: "bg-gradient-to-r from-orange-500 to-amber-500",
    ring: "ring-orange-100",
  },
  red: {
    iconBg: "bg-red-50",
    iconText: "text-red-600",
    bar: "bg-gradient-to-r from-rose-500 to-red-500",
    ring: "ring-red-100",
  },
  purple: {
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    bar: "bg-gradient-to-r from-violet-500 to-purple-500",
    ring: "ring-violet-100",
  },
  indigo: {
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    bar: "bg-gradient-to-r from-indigo-500 to-blue-500",
    ring: "ring-indigo-100",
  },
};

const TICKET_STATUS_META: Record<
  string,
  { label: string; color: AccentColor }
> = {
  draft: { label: "草稿", color: "indigo" },
  pending: { label: "待处理", color: "orange" },
  in_progress: { label: "处理中", color: "blue" },
  ready_to_pick: { label: "待取件", color: "purple" },
  picked_up: { label: "已取件", color: "green" },
  cancelled: { label: "已取消", color: "red" },
  exception: { label: "异常", color: "red" },
  completed: { label: "已完成", color: "green" },
};

/** 统计卡片：图标徽章 + 标签 + 大数值，悬浮抬升 + 顶部渐变条。 */
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: AccentColor;
  icon: PosIconName;
}) {
  const theme = ACCENT_THEME[color];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:ring-1 hover:ring-slate-200">
      <span
        className={`absolute inset-x-0 top-0 h-1 ${theme.bar} opacity-80 transition-opacity duration-200 group-hover:opacity-100`}
      />
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${theme.iconBg} ${theme.iconText} ${theme.ring}`}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

/** 区块标题：图标徽章 + 标题 + 可选副标题 + 可选右侧操作区。 */
function SectionHeader({
  title,
  subtitle,
  icon,
  color,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: PosIconName;
  color: AccentColor;
  action?: React.ReactNode;
}) {
  const theme = ACCENT_THEME[color];

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${theme.iconBg} ${theme.iconText} ${theme.ring}`}
        >
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatusRow({
  status,
  count,
  total,
}: {
  status: string;
  count: number;
  total: number;
}) {
  const meta = TICKET_STATUS_META[status] ?? {
    label: status,
    color: "indigo" as AccentColor,
  };
  const theme = ACCENT_THEME[meta.color];
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-xs font-medium text-slate-600">
        {meta.label}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${theme.bar} transition-all duration-700 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-10 text-right text-sm font-semibold text-slate-900">
        {count}
      </div>
      <div className="w-10 text-right text-xs tabular-nums text-slate-400">
        {percentage}%
      </div>
    </div>
  );
}

/* ----------------------------- 空状态 ----------------------------- */

function EmptyState() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          业务记录
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">统计数据</h1>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon name="chart" className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600">
          还没有可展示的统计信息
        </p>
        <p className="mt-1 text-xs text-slate-400">
          产生订单或工单后，这里会显示经营概况。
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- 主视图 ----------------------------- */

export function StatisticsView({ overview }: StatisticsViewProps) {
  if (!overview) {
    return <EmptyState />;
  }

  const { orders, tickets, customers } = overview;

  const ticketStatusEntries = Object.entries(tickets.byStatus).filter(
    ([, count]) => count > 0,
  );
  const ticketTotal = ticketStatusEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );

  return (
    <div className="space-y-7">
      {/* 页面头部：品牌渐变英雄头部，内嵌今日销售额概览 */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 opacity-70"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-gradient-to-tr from-violet-50 to-blue-50 opacity-80"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              业务记录
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">统计数据</h1>
            <p className="mt-1 text-sm text-slate-500">
              查看门店经营数据：订单、工单和客户统计。
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">今日销售额</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600">
                ¥{orders.totalAmount}
              </p>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">今日订单</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {orders.orderCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 订单统计 */}
      <section>
        <SectionHeader
          title="订单统计"
          subtitle="今日订单与收款概况"
          icon="receipt"
          color="blue"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="今日订单数"
            value={orders.orderCount}
            color="blue"
            icon="receipt"
          />
          <StatCard
            label="今日销售额"
            value={`¥${orders.totalAmount}`}
            color="green"
            icon="wallet-cards"
          />
          <StatCard
            label="已收款"
            value={`¥${orders.paidAmount}`}
            color="green"
            icon="package-check"
          />
          <StatCard
            label="待收款订单"
            value={orders.unpaidCount}
            color="orange"
            icon="clock"
          />
          <StatCard
            label="已完成订单"
            value={orders.deliveredCount}
            color="indigo"
            icon="package-check"
          />
          <StatCard
            label="已取消订单"
            value={orders.cancelledCount}
            color="red"
            icon="x"
          />
        </div>
      </section>

      {/* 工单统计 */}
      <section>
        <SectionHeader
          title="工单统计"
          subtitle="今日工单流转概况"
          icon="clipboard-list"
          color="purple"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="今日工单总数"
            value={tickets.total}
            color="purple"
            icon="clipboard-list"
          />
          <StatCard
            label="已逾期"
            value={tickets.overdueCount}
            color="red"
            icon="alert"
          />
          <StatCard
            label="今日新增"
            value={tickets.todayCreatedCount}
            color="blue"
            icon="plus"
          />
          <StatCard
            label="今日取件"
            value={tickets.todayPickedUpCount}
            color="green"
            icon="package-check"
          />
        </div>

        {/* 工单状态分布 */}
        {ticketStatusEntries.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                工单状态分布
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                共 {ticketTotal} 个工单
              </span>
            </div>
            <div className="space-y-3">
              {ticketStatusEntries.map(([status, count]) => (
                <StatusRow
                  key={status}
                  status={status}
                  count={count}
                  total={ticketTotal}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 客户统计 */}
      <section>
        <SectionHeader
          title="客户统计"
          subtitle="客户存量与新增"
          icon="users"
          color="orange"
        />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="客户总数"
            value={customers.totalCount}
            color="blue"
            icon="users"
          />
          <StatCard
            label="今日新增客户"
            value={customers.todayNewCount}
            color="green"
            icon="user-plus"
          />
        </div>
      </section>
    </div>
  );
}
