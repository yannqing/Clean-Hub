"use client";

import { useMemo, useState } from "react";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Badge, Button } from "@cleanhub/ui";
import {
  ChevronRight,
  CloudUpload,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  WifiOff,
} from "lucide-react";

import { AlertBanner } from "@/components/alert-banner";

import type {
  DeliveryQueueSummary,
  DeliveryTaskListItem,
  DeliveryTaskStatus,
} from "../types";

function getTaskPendingCount(
  queue: DeliveryQueueSummary,
  taskId: string,
): number {
  return queue.items.filter(
    (item) => item.status === "pending" && item.payload.taskId === taskId,
  ).length;
}

export function DeliveryQueueBanner({
  canSync,
  count,
  isSyncing,
  onSync,
}: {
  canSync: boolean;
  count: number;
  isSyncing: boolean;
  onSync: () => void;
}) {
  const { t } = useTranslation();

  if (count <= 0) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-amber-900">
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {t("delivery.queuePending", { count })}
        </span>
      </div>
      <Button
        className="h-9 px-3"
        disabled={!canSync || isSyncing}
        size="sm"
        type="button"
        variant="secondary"
        onClick={onSync}
      >
        {isSyncing ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CloudUpload className="size-4" aria-hidden="true" />
        )}
        {t("delivery.sync")}
      </Button>
    </div>
  );
}

export function DeliveryMessageBanner({
  message,
  tone,
}: {
  message: string;
  tone: "cache" | "error" | "warning";
}) {
  return <AlertBanner message={message} tone={tone} />;
}

export function DeliveryTaskList({
  onSelectTask,
  queue,
  selectedTaskId,
  statusLabelKeys,
  statusTone,
  tasks,
}: {
  onSelectTask: (taskId: string) => void;
  queue: DeliveryQueueSummary;
  selectedTaskId: string | null;
  statusLabelKeys: Record<DeliveryTaskStatus, TranslationKey>;
  statusTone: Record<DeliveryTaskStatus, string>;
  tasks: DeliveryTaskListItem[];
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"all" | "pickup" | "active" | "done" | "exception">("all");
  const filters = useMemo(() => [
    { label: t("customer.filters.all"), value: "all" as const },
    { label: t(statusLabelKeys.pending_dispatch), value: "pickup" as const },
    { label: t(statusLabelKeys.delivering), value: "active" as const },
    { label: t(statusLabelKeys.signed), value: "done" as const },
    { label: t(statusLabelKeys.exception), value: "exception" as const },
  ], [statusLabelKeys, t]);
  const visibleTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "pickup") return ["pending_dispatch", "en_route", "arrived"].includes(task.status);
    if (filter === "active") return ["picked_up", "delivering"].includes(task.status);
    if (filter === "done") return task.status === "signed";
    return task.status === "exception";
  });
  const pickupCount = tasks.filter((task) => ["pending_dispatch", "en_route", "arrived"].includes(task.status)).length;
  const activeCount = tasks.filter((task) => ["picked_up", "delivering"].includes(task.status)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <TaskMetric label={t("delivery.assignedTasks")} value={tasks.length} tone="blue" />
        <TaskMetric label={t(statusLabelKeys.pending_dispatch)} value={pickupCount} tone="amber" />
        <TaskMetric label={t(statusLabelKeys.delivering)} value={activeCount} tone="green" />
      </div>
      <div className="mobile-scrollbar flex gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 shadow-sm" role="tablist">
        {filters.map((item) => (
          <button
            aria-selected={filter === item.value}
            className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition ${
              filter === item.value ? "bg-blue-600 text-white" : "text-slate-600"
            }`}
            key={item.value}
            role="tab"
            type="button"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {t("delivery.assignedTasks")}
          </h2>
          <p className="text-sm text-slate-600">
            {t("delivery.taskCount", { count: visibleTasks.length })}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {visibleTasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            {t("delivery.noTasks")}
          </div>
        ) : (
          visibleTasks.map((task) => {
            const pendingCount = getTaskPendingCount(queue, task.id);
            const isSelected = task.id === selectedTaskId;

            return (
              <article
                className={`w-full rounded-md border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-white active:bg-slate-50"
                }`}
                key={task.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {task.customerName}
                    </p>
                    {task.expectedAt ? (
                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 className="size-3.5 text-blue-600" aria-hidden />
                        {new Date(task.expectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : null}
                    <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-600">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-blue-600" aria-hidden />
                      <span className="line-clamp-2">{task.address}</span>
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone[task.status]}`}
                  >
                    {t(statusLabelKeys[task.status])}
                  </span>
                  {pendingCount > 0 ? (
                    <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                      {t("delivery.pendingSync", { count: pendingCount })}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a className="flex h-10 items-center justify-center gap-1 rounded-md border border-slate-200 text-xs font-semibold text-blue-700" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`} rel="noreferrer" target="_blank">
                    <Navigation className="size-4" aria-hidden />
                    {t("delivery.navigate")}
                  </a>
                  <a className="flex h-10 items-center justify-center gap-1 rounded-md border border-slate-200 text-xs font-semibold text-blue-700" href={task.customerPhone ? `tel:${task.customerPhone}` : undefined} aria-disabled={!task.customerPhone}>
                    <Phone className="size-4" aria-hidden />
                    {t("delivery.call")}
                  </a>
                  <button className="flex h-10 items-center justify-center gap-1 rounded-md bg-blue-600 px-2 text-xs font-semibold text-white" type="button" onClick={() => onSelectTask(task.id)}>
                    {t("delivery.details")}
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
    </div>
  );
}

function TaskMetric({ label, tone, value }: { label: string; tone: "amber" | "blue" | "green"; value: number }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="min-h-24 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}
