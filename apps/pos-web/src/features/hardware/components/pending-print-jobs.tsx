"use client";

import {
  createScopedPrintJobQueue,
  type PersistentPrintJob,
} from "@cleanhub/offline";
import {
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

type StoredPrintJob = PersistentPrintJob<PosPrintJobPayload>;

const STATUS_LABELS: Record<StoredPrintJob["status"], string> = {
  pending: "待打印",
  printing: "打印结果待确认",
  printed: "已打印",
  failed: "打印失败",
};

const subscribeToClientRuntime = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function PendingPrintJobs({
  canReprint,
}: {
  canReprint: boolean;
}) {
  const { tenantId, branchId, terminalId } = usePosRuntimeConfig();
  const clientReady = useSyncExternalStore(
    subscribeToClientRuntime,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<StoredPrintJob[]>([]);
  const queue = useMemo(() => {
    if (!clientReady || !tenantId || !branchId || !terminalId) return null;
    return createScopedPrintJobQueue<PosPrintJobPayload>({
      storage: getPosOfflineStorage(),
      scope: { tenantId, branchId, terminalId },
    });
  }, [branchId, clientReady, tenantId, terminalId]);

  const refresh = useCallback(async () => {
    if (!queue) {
      setJobs([]);
      return;
    }
    const storedJobs = await queue.list();
    setJobs(
      storedJobs
        .filter(
          (job) =>
            job.status !== "printed" ||
            job.payload.auditReportedStatus !== "printed" ||
            job.payload.auditReportedAttempt !== job.attempt,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }, [queue]);

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

  if (jobs.length === 0) return null;

  return (
    <>
      <button
        className="mb-2 flex min-h-9 w-full items-center justify-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Icon className="h-4 w-4 shrink-0" name="printer" />
        <span className="min-w-0 truncate">{jobs.length} 个打印任务待处理</span>
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>待处理打印任务</DialogTitle>
            <DialogDescription>
              离线暂存小票会保留在当前终端。关闭创建弹窗或重新打开应用后，仍可在这里继续打印。
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>
    </>
  );
}
