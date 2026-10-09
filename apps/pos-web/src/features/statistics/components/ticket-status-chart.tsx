"use client";

import {
  type ServiceTicketOverview,
  type ServiceTicketStatus,
} from "@cleanhub/api-client";

import { getTicketStatusLabel } from "@/lib/ticket-labels";

/** Bar colours only; the wording comes from the shared ticket catalogue. */
const STATUS_BAR_CLASSES: Record<ServiceTicketStatus, string> = {
  draft: "bg-muted-foreground",
  pending: "bg-amber-500",
  in_progress: "bg-foreground",
  ready_to_pick: "bg-accent-foreground",
  picked_up: "bg-emerald-500",
  cancelled: "bg-muted-foreground",
  exception: "bg-destructive",
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
  const barClassName = STATUS_BAR_CLASSES[status];
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs font-medium text-muted-foreground">
        {getTicketStatusLabel(status)}
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barClassName}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-semibold text-foreground">
        {count}
      </div>
      <div className="w-12 text-right text-xs text-muted-foreground">
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
      <div className="border-y border-dashed bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">暂无工单数据</p>
      </div>
    );
  }

  return (
    <div className="border-y bg-background p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        工单状态分布
      </h3>
      <div className="space-y-3">
        {activeStatuses.map(([status, count]) => (
          <StatusRow key={status} status={status} count={count} total={total} />
        ))}
      </div>
      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>总计</span>
          <span className="font-semibold text-foreground">{total} 个工单</span>
        </div>
      </div>
    </div>
  );
}
