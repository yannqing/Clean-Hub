"use client";

import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Badge, Button } from "@cleanhub/ui";
import {
  ChevronRight,
  CloudUpload,
  Loader2,
  RefreshCw,
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
  activeAction,
  onRefresh,
  onSelectTask,
  queue,
  selectedTaskId,
  statusLabelKeys,
  statusTone,
  tasks,
}: {
  activeAction: string | null;
  onRefresh: () => void;
  onSelectTask: (taskId: string) => void;
  queue: DeliveryQueueSummary;
  selectedTaskId: string | null;
  statusLabelKeys: Record<DeliveryTaskStatus, TranslationKey>;
  statusTone: Record<DeliveryTaskStatus, string>;
  tasks: DeliveryTaskListItem[];
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {t("delivery.today")}
          </h2>
          <p className="text-sm text-slate-600">
            {t("delivery.taskCount", { count: tasks.length })}
          </p>
        </div>
        <Button
          aria-label={t("common.refresh")}
          className="size-10 p-0"
          disabled={Boolean(activeAction)}
          size="sm"
          type="button"
          variant="outline"
          onClick={onRefresh}
        >
          {activeAction === "refresh" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            {t("delivery.noTasks")}
          </div>
        ) : (
          tasks.map((task) => {
            const pendingCount = getTaskPendingCount(queue, task.id);
            const isSelected = task.id === selectedTaskId;

            return (
              <button
                className={`w-full rounded-md border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 bg-white active:bg-slate-50"
                }`}
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {task.customerName}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                      {task.address}
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
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
