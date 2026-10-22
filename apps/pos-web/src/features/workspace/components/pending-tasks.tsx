"use client";

import type { ReactNode } from "react";

import type { PosPendingTask, PosPendingTaskType } from "@cleanhub/api-client";
import {
  createTranslator,
  defaultLocale,
  normalizeLocale,
  type TranslationKey,
} from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";

import { Icon, type PosIconName } from "@/components/app-shell/icons";
import { posMessage } from "@/lib/pos-message";
import {
  PendingPrintJobs,
  usePendingPrintJobCounts,
} from "@/features/hardware/components/pending-print-jobs";

type Priority = "high" | "medium" | "low";

type SectionHeaderProps = {
  action?: ReactNode;
  description: string;
  icon: PosIconName;
  title: string;
};

const TASK_META: Record<
  PosPendingTaskType,
  { icon: PosIconName }
> = {
  overdue_ticket: {
    icon: "alert",
  },
  unpaid_order: {
    icon: "wallet-cards",
  },
  pending_pickup: {
    icon: "package-check",
  },
};

const PRIORITY_STYLES: Record<
  Priority,
  { badge: string; count: string; icon: string }
> = {
  high: {
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/35 dark:text-red-300",
    count: "bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-300",
    icon: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/35 dark:text-red-300",
  },
  medium: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
    count:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300",
    icon: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
  },
  low: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
    count:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
  },
};

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPendingSummary(count: number, locale: string): string {
  return createTranslator({ locale: normalizeLocale(locale) ?? defaultLocale })(
    "pos.inline.pendingNow",
    { count: formatNumber(count, locale) },
  );
}

function formatTaskCount(count: number, locale: string): string {
  return createTranslator({ locale: normalizeLocale(locale) ?? defaultLocale })(
    "pos.inline.itemCount",
    { count: formatNumber(count, locale) },
  );
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
        <Icon className="h-4 w-4" name={icon} />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyTasks() {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300">
        <Icon className="h-6 w-6" name="package-check" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">暂无待办任务</p>
      <p className="mt-1 text-xs text-muted-foreground">所有任务都已处理完毕</p>
    </div>
  );
}

function TaskCard({
  locale,
  task,
}: {
  locale: string;
  task: PosPendingTask;
}) {
  const meta = TASK_META[task.type] ?? {
    icon: "clipboard-list" as PosIconName,
  };
  const priority = task.priority in PRIORITY_STYLES ? task.priority : "low";
  const style = PRIORITY_STYLES[priority];

  return (
    <Link
      className="group flex min-h-20 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4"
      href={task.actionRoute}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.icon}`}
      >
        <Icon className="h-5 w-5" name={meta.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {task.title}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
          >
            {posMessage(`pos.taskPriority.${task.priority}` as TranslationKey)}
          </span>
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {task.description}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex min-w-14 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums ${style.count}`}
        >
          {formatTaskCount(task.count, locale)}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
          <Icon
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            name="chevron-right"
          />
        </span>
      </span>
    </Link>
  );
}

export function PendingTasks({
  canReprint,
  tasks,
}: {
  canReprint: boolean;
  tasks: PosPendingTask[];
}) {
  const { locale } = useTranslation();
  const { actionable, syncPending } = usePendingPrintJobCounts();
  const localPrintTaskCount = actionable + syncPending;
  const totalPending =
    tasks.reduce((sum, task) => sum + task.count, 0) + localPrintTaskCount;
  const hasPendingTasks = tasks.length > 0 || localPrintTaskCount > 0;

  return (
    <section className="space-y-4">
      <SectionHeader
        action={
          hasPendingTasks ? (
            <span className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs font-semibold text-muted-foreground">
              {formatPendingSummary(totalPending, locale)}
            </span>
          ) : null
        }
        description="按优先级处理门店当前风险"
        icon="clock"
        title="待办任务"
      />

      {!hasPendingTasks ? (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <EmptyTasks />
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <PendingPrintJobs canReprint={canReprint} variant="task" />
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              locale={locale}
              task={task}
            />
          ))}
        </div>
      )}
    </section>
  );
}
