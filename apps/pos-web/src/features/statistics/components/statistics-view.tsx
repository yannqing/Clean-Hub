"use client";

import type { PosStatisticsOverview } from "@cleanhub/api-client";

type StatisticsViewProps = {
  overview: PosStatisticsOverview | null;
};

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "blue" | "green" | "orange" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    red: "bg-red-50 text-red-600 border-red-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export function StatisticsView({ overview }: StatisticsViewProps) {
  if (!overview) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            业务记录
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">统计数据</h1>
          <p className="mt-1 text-sm text-slate-500">暂无统计数据</p>
        </div>
      </div>
    );
  }

  const { orders, tickets, customers } = overview;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          业务记录
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">统计数据</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看门店经营数据：订单、工单和客户统计。
        </p>
      </div>

      {/* 订单统计 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          订单统计
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="今日订单数"
            value={orders.orderCount}
            color="blue"
          />
          <StatCard
            label="今日销售额"
            value={`¥${orders.totalAmount}`}
            color="green"
          />
          <StatCard
            label="已收款"
            value={`¥${orders.paidAmount}`}
            color="green"
          />
          <StatCard
            label="待收款订单"
            value={orders.unpaidCount}
            color="orange"
          />
          <StatCard
            label="已完成订单"
            value={orders.deliveredCount}
            color="blue"
          />
          <StatCard
            label="已取消订单"
            value={orders.cancelledCount}
            color="red"
          />
        </div>
      </section>

      {/* 工单统计 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          工单统计
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="今日工单总数"
            value={tickets.total}
            color="purple"
          />
          <StatCard
            label="已逾期"
            value={tickets.overdueCount}
            color="red"
          />
          <StatCard
            label="今日新增"
            value={tickets.todayCreatedCount}
            color="blue"
          />
          <StatCard
            label="今日取件"
            value={tickets.todayPickedUpCount}
            color="green"
          />
        </div>

        {/* 工单状态分布 */}
        {Object.keys(tickets.byStatus).length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-600">
              工单状态分布
            </h3>
            <div className="space-y-2">
              {Object.entries(tickets.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{status}</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 客户统计 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          客户统计
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="客户总数"
            value={customers.totalCount}
            color="blue"
          />
          <StatCard
            label="今日新增客户"
            value={customers.todayNewCount}
            color="green"
          />
        </div>
      </section>
    </div>
  );
}
