"use client";

import type { PosStatisticsOverview } from "@cleanhub/api-client";

type WorkspaceStatisticsProps = {
  overview: PosStatisticsOverview | null;
};

function MiniStatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "blue" | "green" | "orange" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

export function WorkspaceStatistics({ overview }: WorkspaceStatisticsProps) {
  if (!overview) {
    return null;
  }

  const { orders, tickets, customers } = overview;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        今日概况
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStatCard
          label="订单数"
          value={orders.orderCount}
          color="blue"
        />
        <MiniStatCard
          label="销售额"
          value={`¥${orders.totalAmount}`}
          color="green"
        />
        <MiniStatCard
          label="工单数"
          value={tickets.total}
          color="purple"
        />
        <MiniStatCard
          label="新增客户"
          value={customers.todayNewCount}
          color="orange"
        />
      </div>
    </section>
  );
}
