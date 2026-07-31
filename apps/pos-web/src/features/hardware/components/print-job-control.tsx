"use client";

import type { PosPrintDocumentType } from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import {
  createScopedPrintJobQueue,
  type PersistentPrintJob,
} from "@cleanhub/offline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posToast as toast } from "@/lib/pos-toast";

import { getDesktopBridge, getPosOfflineStorage } from "../lib/desktop-bridge";
import {
  executePosPrintJob,
  type PosPrintJobPayload,
} from "../lib/pos-print-job";

type ScopedPrintJob = PersistentPrintJob<PosPrintJobPayload>;

type PrintJobControlProps = {
  canReprint: boolean;
  content: string;
  documentType: PosPrintDocumentType;
  entityId: string;
  initialLabel: string;
  title: string;
};

const STATUS_COPY = {
  pending: "待打印",
  printing: "打印中",
  printed: "已打印",
  failed: "打印失败",
} as const;

const subscribeToClientRuntime = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function PrintJobControl({
  canReprint,
  content,
  documentType,
  entityId,
  initialLabel,
  title,
}: PrintJobControlProps) {
  const { tenantId, branchId, terminalId } = usePosRuntimeConfig();
  const clientReady = useSyncExternalStore(
    subscribeToClientRuntime,
    getClientSnapshot,
    getServerSnapshot,
  );
  const scopeKey = `${tenantId ?? ""}:${branchId ?? ""}:${terminalId ?? ""}`;
  const [jobSnapshot, setJobSnapshot] = useState<{
    scopeKey: string;
    jobs: ScopedPrintJob[];
  }>({ scopeKey: "", jobs: [] });
  const [busy, setBusy] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintReason, setReprintReason] = useState("");
  const [auditError, setAuditError] = useState<string | null>(null);
  const reportingRef = useRef(new Set<string>());

  const queue = useMemo(() => {
    if (!clientReady || !tenantId || !branchId || !terminalId) return null;
    return createScopedPrintJobQueue<PosPrintJobPayload>({
      storage: getPosOfflineStorage(),
      scope: { tenantId, branchId, terminalId },
    });
  }, [branchId, clientReady, tenantId, terminalId]);

  const refresh = useCallback(async () => {
    if (!queue) {
      setJobSnapshot({ scopeKey, jobs: [] });
      return;
    }
    const storedJobs = await queue.list();
    setJobSnapshot({
      scopeKey,
      jobs: storedJobs.filter(
        (job) =>
          job.payload.documentType === documentType &&
          job.payload.entityId === entityId,
      ),
    });
  }, [documentType, entityId, queue, scopeKey]);

  useEffect(() => {
    let active = true;
    if (!queue) return () => undefined;

    void queue
      .list()
      .then((storedJobs) => {
        if (!active) return;
        setJobSnapshot({
          scopeKey,
          jobs: storedJobs.filter(
            (job) =>
              job.payload.documentType === documentType &&
              job.payload.entityId === entityId,
          ),
        });
      })
      .catch((error) => {
        if (!active) return;
        setAuditError(
          error instanceof Error ? error.message : "无法读取本地打印任务。",
        );
      });

    return () => {
      active = false;
    };
  }, [documentType, entityId, queue, scopeKey]);

  const latestJob = useMemo(() => {
    const scopedJobs =
      jobSnapshot.scopeKey === scopeKey ? jobSnapshot.jobs : [];
    return (
      [...scopedJobs].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0] ?? null
    );
  }, [jobSnapshot, scopeKey]);

  useEffect(() => {
    if (
      !latestJob ||
      (latestJob.status !== "printed" && latestJob.status !== "failed")
    ) {
      return;
    }

    const reportKey = `${latestJob.id}:${latestJob.status}:${latestJob.attempt}`;
    if (reportingRef.current.has(reportKey)) return;
    reportingRef.current.add(reportKey);
    setAuditError(null);

    void posApi.pos.hardware
      .recordPrintJobResult({
        jobId: latestJob.id,
        documentType: latestJob.payload.documentType,
        entityId: latestJob.payload.entityId,
        status: latestJob.status,
        attempt: latestJob.attempt,
        error: latestJob.lastError,
        authorizationId: latestJob.payload.authorizationId,
        originalPrintJobId: latestJob.payload.originalPrintJobId,
      })
      .catch((error) => {
        reportingRef.current.delete(reportKey);
        setAuditError(
          getPosApiErrorMessage(
            error,
            "打印结果审计尚未同步，联网后请刷新重试。",
          ),
        );
      });
  }, [latestJob]);

  const runJob = useCallback(
    async (job: ScopedPrintJob) => {
      if (!queue) return;
      setBusy(true);
      setAuditError(null);
      try {
        const result = await queue.retry(job.id, (storedJob) =>
          executePosPrintJob(storedJob, getDesktopBridge()?.hardware ?? null),
        );
        await refresh();
        if (result.status === "printed") {
          toast.success(
            `${documentType === "receipt" ? "小票" : "标签"}已打印。`,
          );
        } else {
          toast.error(
            result.lastError ?? "打印失败，请检查打印机后重试原任务。",
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "打印任务处理失败。",
        );
        await refresh().catch(() => undefined);
      } finally {
        setBusy(false);
      }
    },
    [documentType, queue, refresh],
  );

  async function startInitialPrint() {
    if (!queue) {
      toast.error("当前终端缺少租户、门店或终端范围，无法保存打印任务。");
      return;
    }
    const job = await queue.enqueue({
      id: createId(),
      idempotencyKey: `pos-print:${documentType}:${entityId}:initial`,
      payload: { documentType, entityId, title, content },
    });
    await refresh();
    await runJob(job);
  }

  async function authorizeAndReprint() {
    const reason = reprintReason.trim();
    if (!reason || !latestJob || !queue) {
      toast.error("请填写重打原因。");
      return;
    }

    setBusy(true);
    try {
      const authorization =
        await posApi.pos.hardware.authorizePrivilegedReprint({
          reason,
          documentType,
          entityId,
          originalPrintJobId: latestJob.id,
        });
      const reprintJob = await queue.enqueue({
        id: createId(),
        idempotencyKey: `pos-print:${documentType}:${entityId}:reprint:${authorization.authorizationId}`,
        payload: {
          documentType,
          entityId,
          title,
          content,
          authorizationId: authorization.authorizationId,
          originalPrintJobId: latestJob.id,
        },
      });
      setReprintOpen(false);
      setReprintReason("");
      await refresh();
      setBusy(false);
      await runJob(reprintJob);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "重打授权失败，请稍后重试。"));
    } finally {
      setBusy(false);
    }
  }

  const retryable =
    latestJob && latestJob.status !== "printed" ? latestJob : null;
  const buttonLabel = busy
    ? "正在打印"
    : retryable
      ? "重试原任务"
      : latestJob?.status === "printed"
        ? canReprint
          ? `重打${documentType === "receipt" ? "小票" : "标签"}`
          : `${documentType === "receipt" ? "小票" : "标签"}已打印`
        : initialLabel;
  const statusTone =
    latestJob?.status === "failed"
      ? "text-destructive"
      : latestJob?.status === "printed"
        ? "text-emerald-700"
        : "text-amber-700";

  return (
    <div className="min-w-0">
      <button
        className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={
          busy || !queue || (latestJob?.status === "printed" && !canReprint)
        }
        onClick={() => {
          if (retryable) {
            void runJob(retryable);
          } else if (latestJob?.status === "printed") {
            setReprintOpen(true);
          } else {
            void startInitialPrint();
          }
        }}
        type="button"
      >
        <Icon className="h-4 w-4" name="printer" />
        {buttonLabel}
      </button>

      {latestJob ? (
        <p className={`mt-1 max-w-64 text-xs ${statusTone}`} role="status">
          {STATUS_COPY[latestJob.status]} · 第 {latestJob.attempt} 次
          {latestJob.lastError ? ` · ${latestJob.lastError}` : ""}
        </p>
      ) : null}
      {auditError ? (
        <p className="mt-1 max-w-64 text-xs text-amber-700" role="status">
          {auditError}
        </p>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open && !busy) setReprintReason("");
          setReprintOpen(open);
        }}
        open={reprintOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              重打{documentType === "receipt" ? "小票" : "标签"}
            </DialogTitle>
            <DialogDescription>
              已成功打印的文件再次打印需要 Owner 或 Manager
              授权，原因和终端会写入审计记录。
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            重打原因
            <textarea
              className="min-h-24 rounded-lg border border-border bg-background px-3 py-2 font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              disabled={busy}
              maxLength={500}
              onChange={(event) => setReprintReason(event.target.value)}
              placeholder="例如：客户要求补打一份"
              value={reprintReason}
            />
          </label>
          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              disabled={busy}
              onClick={() => setReprintOpen(false)}
              type="button"
            >
              返回
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !reprintReason.trim()}
              onClick={() => void authorizeAndReprint()}
              type="button"
            >
              <Icon className="h-4 w-4" name="printer" />
              {busy ? "授权中" : "授权并重打"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
