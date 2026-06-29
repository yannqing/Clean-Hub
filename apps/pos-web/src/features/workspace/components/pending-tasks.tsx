"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PosPendingTask, PosPendingTaskType } from "@cleanhub/api-client";
import { Icon, type PosIconName } from "@/components/app-shell/icons";

type SectionHeaderProps = {
  title: string;
  action?: React.ReactNode;
};

function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
          <Icon name="clock" className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** 按任务类型映射图标与语义标签。 */
const TASK_META: Record<
  PosPendingTaskType,
  { label: string; icon: PosIconName }
> = {
  overdue_ticket: {
    label: "逾期工单",
    icon: "alert",
  },
  unpaid_order: {
    label: "待收款订单",
    icon: "wallet-cards",
  },
  pending_pickup: {
    label: "待取件工单",
    icon: "package-check",
  },
};

const PRIORITY_ACCENT: Record<
  "high" | "medium" | "low",
  { border: string; dot: string; chip: string; hover: string; iconBg: string }
> = {
  high: {
    border: "border-l-rose-500",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
    hover: "hover:border-rose-200 hover:bg-rose-50/40",
    iconBg: "bg-rose-50 text-rose-600",
  },
  medium: {
    border: "border-l-orange-500",
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-600 ring-1 ring-orange-200",
    hover: "hover:border-orange-200 hover:bg-orange-50/40",
    iconBg: "bg-orange-50 text-orange-600",
  },
  low: {
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
    hover: "hover:border-blue-200 hover:bg-blue-50/40",
    iconBg: "bg-blue-50 text-blue-600",
  },
};

const PRIORITY_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};

export function PendingTasks() {
  const [tasks, setTasks] = useState<PosPendingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch("/api/workspace/pending-tasks");
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch pending tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return (
      <section>
        <SectionHeader title="待办任务" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </section>
    );
  }

  if (tasks.length === 0) {
    return (
      <section>
        <SectionHeader title="待办任务" />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 ring-1 ring-emerald-100">
            <Icon name="package-check" className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">暂无待办任务</p>
          <p className="mt-0.5 text-xs text-slate-400">所有任务都已处理完毕</p>
        </div>
      </section>
    );
  }

  const totalPending = tasks.reduce((sum, task) => sum + task.count, 0);

  return (
    <section>
      <SectionHeader
        title="待办任务"
        action={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            待处理 {totalPending}
          </span>
        }
      />
      <div className="space-y-3">
        {tasks.map((task) => {
          const meta = TASK_META[task.type] ?? {
            label: task.title,
            icon: "clipboard-list" as PosIconName,
          };
          const accent = PRIORITY_ACCENT[task.priority] ?? PRIORITY_ACCENT.low;

          return (
            <Link
              key={task.id}
              href={task.actionRoute}
              className={`block rounded-2xl border border-slate-200/80 border-l-4 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${accent.border} ${accent.hover}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}
                  >
                    <Icon name={meta.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {task.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${accent.chip}`}
                  >
                    {task.count}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${accent.dot}`}
                    />
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
