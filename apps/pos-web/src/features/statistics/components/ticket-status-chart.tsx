"use client";

import {
  type ServiceTicketOverview,
  type ServiceTicketStatus,
} from "@cleanhub/api-client";

const STATUS_CONFIG: Record<
  ServiceTicketStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: { label: "草稿", color: "text-slate-600", bgColor: "bg-slate-100" },
  pending: {
    label: "待处理",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  in_progress: {
    label: "处理中",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  ready_to_pick: {
    label: "待取件",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  picked_up: {
    label: "已取件",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  cancelled: {
    label: "已取消",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  exception: { label: "异常", color: "text-red-600", bgColor: "bg-red-100" },
};

function StatusRow({
  status,
  count,
  total,
}: {
  status: ServiceTicketStatus;
  count: number;
  total: number;
}) {
  const config = STATUS_CONFIG[status];
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs font-medium text-slate-600">
        {config.label}
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${config.bgColor.replace("100", "400")}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-semibold text-slate-900">
        {count}
      </div>
      <div className="w-12 text-right text-xs text-slate-500">
        {percentage}%
      </div>
    </div>
  );
}

export function TicketStatusChart({
  overview,
}: {
  overview: ServiceTicketOverview | null;
}) {
  if (!overview) {
    return null;
  }

  const statusEntries = Object.entries(overview.byStatus) as [
    ServiceTicketStatus,
    number,
  ][];

  // Filter out statuses with 0 count for cleaner display
  const activeStatuses = statusEntries.filter(([, count]) => count > 0);

  // Calculate total for percentage calculation
  const total = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">暂无工单数据</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">
        工单状态分布
      </h3>
      <div className="space-y-3">
        {activeStatuses.map(([status, count]) => (
          <StatusRow key={status} status={status} count={count} total={total} />
        ))}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>总计</span>
          <span className="font-semibold text-slate-700">{total} 个工单</span>
        </div>
      </div>
    </div>
  );
}
