"use client";

import type { PosWorkspaceStatistics } from "@cleanhub/api-client";
import { Icon, type PosIconName } from "@/components/app-shell/icons";

type WorkspaceStatisticsProps = {
  statistics: PosWorkspaceStatistics | null;
};

type AccentColor = "blue" | "green" | "orange" | "purple" | "indigo";

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

function MiniStatCard({
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
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${theme.iconBg} ${theme.iconText} ${theme.ring}`}
      >
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-2.5 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function WorkspaceStatistics({ statistics }: WorkspaceStatisticsProps) {
  if (!statistics) {
    return null;
  }

  const { orders, tickets, customers } = statistics;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <Icon name="chart" className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">今日概况</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-emerald-100">
          实时
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStatCard
          label="订单数"
          value={orders.orderCount}
          color="blue"
          icon="receipt"
        />
        <MiniStatCard
          label="销售额"
          value={`¥${orders.totalAmount}`}
          color="green"
          icon="wallet-cards"
        />
        <MiniStatCard
          label="工单数"
          value={tickets.total}
          color="purple"
          icon="clipboard-list"
        />
        <MiniStatCard
          label="新增客户"
          value={customers.todayNewCount}
          color="orange"
          icon="user-plus"
        />
      </div>
    </section>
  );
}
