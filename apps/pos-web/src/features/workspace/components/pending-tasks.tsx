"use client";

import type { CSSProperties, ReactNode } from "react";

import type { PosPendingTask, PosPendingTaskType } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import { Icon, type PosIconName } from "@/components/app-shell/icons";

type Priority = "high" | "medium" | "low";

type SectionHeaderProps = {
  action?: ReactNode;
  description: string;
  icon: PosIconName;
  title: string;
};

const CHART_COLORS = {
  high: "var(--chart-5)",
  medium: "var(--chart-1)",
  low: "var(--chart-2)",
  section: "var(--chart-5)",
} as const;

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

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPendingSummary(count: number, locale: string): string {
  const value = formatNumber(count, locale);

  if (locale === "en") {
    return `${value} pending`;
  }

  if (locale === "fr") {
    return `${value} en attente`;
  }

  return `当前待处理 ${value} 项`;
}

function iconAccentStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklch, ${color} 12%, white)`,
    borderColor: `color-mix(in oklch, ${color} 22%, white)`,
    color,
  };
}

function SectionHeader({
  action,
  description,
  icon,
  title,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white">
          <Icon className="h-4 w-4" name={icon} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyTasks() {
  return (
    <div className="border-y border-dashed border-slate-300 bg-white p-8 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border"
        style={iconAccentStyle(CHART_COLORS.low)}
      >
        <Icon className="h-6 w-6" name="package-check" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">暂无待办任务</p>
      <p className="mt-1 text-xs text-slate-500">所有任务都已处理完毕</p>
    </div>
  );
}

function TaskCard({
  locale,
  maxCount,
  task,
}: {
  locale: string;
  maxCount: number;
  task: PosPendingTask;
}) {
  const meta = TASK_META[task.type] ?? {
    label: task.title,
    icon: "clipboard-list" as PosIconName,
  };
  const priority = task.priority in PRIORITY_LABELS ? task.priority : "low";
  const color = CHART_COLORS[priority];
  const width =
    task.count > 0 ? Math.max((task.count / maxCount) * 100, 10) : 0;

  return (
    <Link
      className="group block border-y border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      href={task.actionRoute}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={iconAccentStyle(color)}
          >
            <Icon className="h-5 w-5" name={meta.icon} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-950">
                {task.title}
              </h3>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {meta.label}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
              {task.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-3">
          <span
            className="inline-flex min-w-10 items-center justify-center rounded-md px-2.5 py-1 text-sm font-bold"
            style={iconAccentStyle(color)}
          >
            {formatNumber(task.count, locale)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 group-hover:text-slate-800">
            处理
            <Icon className="h-3.5 w-3.5" name="chevron-right" />
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
          <span>{PRIORITY_LABELS[priority]}</span>
          <span>待处理事项</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ backgroundColor: color, width: `${width}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export function PendingTasks({ tasks }: { tasks: PosPendingTask[] }) {
  const { locale } = useTranslation();
  const totalPending = tasks.reduce((sum, task) => sum + task.count, 0);
  const maxCount = Math.max(...tasks.map((task) => task.count), 1);

  return (
    <section className="space-y-4">
      <SectionHeader
        action={
          tasks.length > 0 ? (
            <span className="inline-flex h-8 items-center rounded-md bg-slate-100 px-3 text-xs font-semibold text-slate-600">
              {formatPendingSummary(totalPending, locale)}
            </span>
          ) : null
        }
        description="按优先级处理门店当前风险"
        icon="clock"
        title="待办任务"
      />

      {tasks.length === 0 ? (
        <EmptyTasks />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              locale={locale}
              maxCount={maxCount}
              task={task}
            />
          ))}
        </div>
      )}
    </section>
  );
}
