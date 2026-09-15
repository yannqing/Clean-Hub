"use client";

import {
  createScopedPrintJobQueue,
  type PersistentPrintJob,
} from "@cleanhub/offline";
import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";

import { getPosOfflineStorage } from "../lib/desktop-bridge";
import {
  POS_PRINT_QUEUE_UPDATED_EVENT,
  type PosPrintJobPayload,
} from "../lib/pos-print-job";
import { PrintJobControl } from "./print-job-control";

export type PendingPrintJob = PersistentPrintJob<PosPrintJobPayload>;
export type PendingPrintJobsVariant = "notification" | "task" | "center";

export type PendingPrintJobCounts = {
  actionable: number;
  syncPending: number;
  total: number;
};

export type PendingPrintJobsState = PendingPrintJobCounts & {
  actionableJobs: PendingPrintJob[];
  jobs: PendingPrintJob[];
  refresh: () => Promise<void>;
  syncPendingJobs: PendingPrintJob[];
};

const STATUS_LABELS: Record<PendingPrintJob["status"], string> = {
  pending: "待打印",
  printing: "打印结果待确认",
  printed: "已打印，审计记录待同步",
  failed: "打印失败",
};

const subscribeToClientRuntime = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function isActionablePrintJob(job: PendingPrintJob): boolean {
  return (
    job.status === "pending" ||
    job.status === "printing" ||
    job.status === "failed"
  );
}

function isPrintAuditSyncPending(job: PendingPrintJob): boolean {
  return (
    job.status === "printed" &&
    (job.payload.auditReportedStatus !== "printed" ||
      job.payload.auditReportedAttempt !== job.attempt)
  );
}

function getCounts(
  actionableJobs: PendingPrintJob[],
  syncPendingJobs: PendingPrintJob[],
): PendingPrintJobCounts {
  return {
    actionable: actionableJobs.length,
    syncPending: syncPendingJobs.length,
    total: actionableJobs.length + syncPendingJobs.length,
  };
}

/**
 * Reads only the print queue scoped to the currently enrolled terminal.
 * Printed jobs awaiting audit upload are intentionally kept separate from
 * jobs that still require a printing decision or retry.
 */
export function usePendingPrintJobs(): PendingPrintJobsState {
  const { tenantId, branchId, terminalId } = usePosRuntimeConfig();
  const clientReady = useSyncExternalStore(
    subscribeToClientRuntime,
    getClientSnapshot,
    getServerSnapshot,
  );
  const scopeKey = `${tenantId ?? ""}:${branchId ?? ""}:${terminalId ?? ""}`;
  const [snapshot, setSnapshot] = useState<{
    jobs: PendingPrintJob[];
    scopeKey: string;
  }>({ jobs: [], scopeKey: "" });

  const queue = useMemo(() => {
    if (!clientReady || !tenantId || !branchId || !terminalId) return null;
    return createScopedPrintJobQueue<PosPrintJobPayload>({
      storage: getPosOfflineStorage(),
      scope: { tenantId, branchId, terminalId },
    });
  }, [branchId, clientReady, tenantId, terminalId]);

  const refresh = useCallback(async () => {
    if (!queue) {
      setSnapshot({ jobs: [], scopeKey });
      return;
    }

    const storedJobs = await queue.list();
    setSnapshot({
      jobs: storedJobs
        .filter(
          (job) =>
            isActionablePrintJob(job) || isPrintAuditSyncPending(job),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      scopeKey,
    });
  }, [queue, scopeKey]);

  useEffect(() => {
    const handleRefresh = () => void refresh().catch(() => undefined);
    handleRefresh();
    window.addEventListener(POS_PRINT_QUEUE_UPDATED_EVENT, handleRefresh);
    window.addEventListener("online", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener(POS_PRINT_QUEUE_UPDATED_EVENT, handleRefresh);
      window.removeEventListener("online", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [refresh]);

  const jobs = useMemo(
    () => (snapshot.scopeKey === scopeKey ? snapshot.jobs : []),
    [scopeKey, snapshot],
  );
  const actionableJobs = useMemo(
    () => jobs.filter(isActionablePrintJob),
    [jobs],
  );
  const syncPendingJobs = useMemo(
    () => jobs.filter(isPrintAuditSyncPending),
    [jobs],
  );
  const counts = getCounts(actionableJobs, syncPendingJobs);

  return {
    ...counts,
    actionableJobs,
    jobs,
    refresh,
    syncPendingJobs,
  };
}

/** A count-only facade for badges in the shell, notification UI, or home page. */
export function usePendingPrintJobCounts(): PendingPrintJobCounts {
  const { actionable, syncPending, total } = usePendingPrintJobs();
  return { actionable, syncPending, total };
}

function getPendingSummary({
  actionable,
  syncPending,
}: PendingPrintJobCounts): string {
  const parts: string[] = [];
  if (actionable > 0) parts.push(`${actionable} 个打印任务待处理`);
  if (syncPending > 0) parts.push(`${syncPending} 条打印记录待同步`);
  return parts.join("，");
}

function PendingPrintJobsTrigger({
  counts,
  onClick,
  variant,
}: {
  counts: PendingPrintJobCounts;
  onClick: () => void;
  variant: PendingPrintJobsVariant;
}) {
  const summary = getPendingSummary(counts);

  if (variant === "task") {
    return (
      <button
        className="group flex min-h-20 w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4"
        onClick={onClick}
        type="button"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300">
          <Icon className="h-5 w-5" name="printer" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              打印任务
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300">
              待处理
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {summary}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex min-w-14 items-center justify-center rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-amber-700 dark:bg-amber-950/35 dark:text-amber-300">
            {counts.total}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
            <Icon
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              name="chevron-right"
            />
          </span>
        </span>
      </button>
    );
  }

  if (variant === "center") {
    return (
      <button
        className="group flex w-full items-center justify-between gap-4 border-y border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClick}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300">
            <Icon className="h-4 w-4" name="printer" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              本机打印任务
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {summary}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
          查看详情
          <Icon className="h-3.5 w-3.5" name="chevron-right" />
        </span>
      </button>
    );
  }

  return (
    <button
      className="group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      type="button"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300">
        <Icon className="h-4 w-4" name="printer" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          打印任务
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {summary}
        </span>
      </span>
      <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold leading-6 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        {counts.total}
      </span>
    </button>
  );
}

function PrintJobList({
  canReprint,
  jobs,
}: {
  canReprint: boolean;
  jobs: PendingPrintJob[];
}) {
  return (
    <div className="grid gap-3">
      {jobs.map((job) => (
        <article className="grid gap-3 rounded-xl border p-4" key={job.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {job.payload.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {STATUS_LABELS[job.status]} · 第 {job.attempt} 次
              </p>
            </div>
            <PrintJobControl
              canReprint={canReprint}
              content={job.payload.content}
              documentType={job.payload.documentType}
              entityId={job.payload.entityId}
              initialLabel="打印"
              qrCodeContent={job.payload.qrCodeContent}
              title={job.payload.title}
            />
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              查看打印内容
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-5 text-foreground">
              {job.payload.content}
            </pre>
          </details>
        </article>
      ))}
    </div>
  );
}

export function PendingPrintJobs({
  canReprint,
  variant = "notification",
}: {
  canReprint: boolean;
  variant?: PendingPrintJobsVariant;
}) {
  const [open, setOpen] = useState(false);
  const {
    actionable,
    actionableJobs,
    syncPending,
    syncPendingJobs,
    total,
  } = usePendingPrintJobs();

  if (total === 0) return null;

  const counts = { actionable, syncPending, total };

  return (
    <>
      <PendingPrintJobsTrigger
        counts={counts}
        onClick={() => setOpen(true)}
        variant={variant}
      />

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>打印任务与同步记录</DialogTitle>
            <DialogDescription>
              打印任务保留在当前终端；已完成打印但尚未同步的记录，会在联网后继续上传审计结果。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            {actionable > 0 ? (
              <section className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      需要处理
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      包含待打印、打印失败和打印结果待确认的任务。
                    </p>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/35 dark:text-amber-300">
                    {actionable} 项
                  </span>
                </div>
                <PrintJobList
                  canReprint={canReprint}
                  jobs={actionableJobs}
                />
              </section>
            ) : null}

            {syncPending > 0 ? (
              <section
                className={cn(
                  "grid gap-3",
                  actionable > 0 && "border-t pt-5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      打印记录待同步
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      小票已经打印，仅审计结果尚未上传，不需要再次打印。
                    </p>
                  </div>
                  <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/35 dark:text-sky-300">
                    {syncPending} 条
                  </span>
                </div>
                <PrintJobList
                  canReprint={canReprint}
                  jobs={syncPendingJobs}
                />
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
