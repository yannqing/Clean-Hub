"use client";

import type { PosPrintDocumentType } from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import {
  createScopedPrintJobQueue,
  type PersistentPrintJob,
} from "@cleanhub/offline";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Icon } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";
import { posMessage } from "@/lib/pos-message";
import { posToast as toast } from "@/lib/pos-toast";
import type { TranslationKey } from "@cleanhub/i18n";

import {
  getPosHardwareBridge,
  getPosOfflineStorage,
} from "../lib/desktop-bridge";
import {
  executePosPrintJob,
  notifyPosPrintQueueUpdated,
  resolveConfiguredPrinterId,
  type PosPrintJobPayload,
} from "../lib/pos-print-job";
import { loadPosHardwareDevices } from "../lib/hardware-device-cache";

type ScopedPrintJob = PersistentPrintJob<PosPrintJobPayload>;

type PrintJobControlProps = {
  canReprint: boolean;
  content: string;
  documentType: PosPrintDocumentType;
  entityId: string;
  initialLabel: string;
  qrCodeContent?: string;
  title: string;
};

const subscribeToClientRuntime = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function PrintJobControl({
  canReprint,
  content,
  documentType,
  entityId,
  initialLabel,
  qrCodeContent,
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

  const resolvePrinterId = useCallback(async () => {
    if (!tenantId || !branchId || !terminalId) {
      throw new Error("当前终端缺少租户、门店或终端范围，无法选择打印机。");
    }
    const devices = await loadPosHardwareDevices({
      tenantId,
      branchId,
      terminalId,
    });
    return resolveConfiguredPrinterId(devices, documentType);
  }, [branchId, documentType, tenantId, terminalId]);

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
      (latestJob.payload.auditReportedStatus === latestJob.status &&
        latestJob.payload.auditReportedAttempt === latestJob.attempt) ||
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
      .then(async () => {
        if (!queue) return;
        await queue.updatePayload(latestJob.id, (payload) => ({
          ...payload,
          auditReportedAt: new Date().toISOString(),
          auditReportedStatus: latestJob.status as "printed" | "failed",
          auditReportedAttempt: latestJob.attempt,
        }));
        await refresh();
        notifyPosPrintQueueUpdated();
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
  }, [latestJob, queue, refresh]);

  const runJob = useCallback(
    async (job: ScopedPrintJob) => {
      if (!queue) return;
      setBusy(true);
      setAuditError(null);
      try {
        let preparedJob = job;
        if (!job.payload.printerId) {
          const printerId = await resolvePrinterId();
          preparedJob =
            (await queue.updatePayload(job.id, (payload) => ({
              ...payload,
              printerId,
            }))) ?? job;
        }
        const result = await queue.retry(preparedJob.id, (storedJob) =>
          executePosPrintJob(storedJob, getPosHardwareBridge()),
        );
        await refresh();
        notifyPosPrintQueueUpdated();
        if (result.status === "printed") {
          toast.success(
            posMessage(
              documentType === "receipt"
                ? "pos.inline.receiptPrinted"
                : "pos.inline.labelPrinted",
            ),
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
    [documentType, queue, refresh, resolvePrinterId],
  );

  async function startInitialPrint() {
    if (!queue) {
      toast.error("当前终端缺少租户、门店或终端范围，无法保存打印任务。");
      return;
    }
    let printerId: string;
    try {
      printerId = await resolvePrinterId();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法选择打印机。");
      return;
    }
    const job = await queue.enqueue({
      id: createId(),
      idempotencyKey: `pos-print:${documentType}:${entityId}:initial`,
      payload: {
        documentType,
        entityId,
        title,
        content,
        qrCodeContent,
        autoPrint: true,
        printerId,
      },
    });
    await refresh();
    notifyPosPrintQueueUpdated();
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
      const printerId = await resolvePrinterId();
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
          qrCodeContent,
          autoPrint: true,
          printerId,
          authorizationId: authorization.authorizationId,
          originalPrintJobId: latestJob.id,
        },
      });
      setReprintOpen(false);
      setReprintReason("");
      await refresh();
      notifyPosPrintQueueUpdated();
      setBusy(false);
      await runJob(reprintJob);
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "重打授权失败，请稍后重试。"));
    } finally {
      setBusy(false);
    }
  }

  const retryable =
    latestJob &&
    (latestJob.status === "pending" || latestJob.status === "failed")
      ? latestJob
      : null;
  const uncertainPrint = latestJob?.status === "printing" ? latestJob : null;
  const buttonLabel = busy
    ? "正在打印"
    : retryable
      ? "重试原任务"
      : uncertainPrint
        ? canReprint
          ? "确认打印结果"
          : "打印结果待确认"
        : latestJob?.status === "printed"
          ? canReprint
            ? posMessage(
                documentType === "receipt"
                  ? "pos.inline.reprintReceipt"
                  : "pos.inline.reprintLabel",
              )
            : posMessage(
                documentType === "receipt"
                  ? "pos.inline.receiptPrintedShort"
                  : "pos.inline.labelPrintedShort",
              )
          : initialLabel;
  const statusTone =
    latestJob?.status === "failed"
      ? "text-destructive"
      : latestJob?.status === "printed"
        ? "text-emerald-700"
        : "text-amber-700";

  return (
    <div className="min-w-0">
      <Button
        className="h-11"
        disabled={
          busy ||
          !queue ||
          ((latestJob?.status === "printed" ||
            latestJob?.status === "printing") &&
            !canReprint)
        }
        onClick={() => {
          if (retryable) {
            void runJob(retryable);
          } else if (
            latestJob?.status === "printed" ||
            latestJob?.status === "printing"
          ) {
            setReprintOpen(true);
          } else {
            void startInitialPrint();
          }
        }}
        type="button"
        variant="outline"
      >
        <Icon className="h-4 w-4" name="printer" />
        {buttonLabel}
      </Button>

      {latestJob ? (
        <p className={`mt-1 max-w-64 text-xs ${statusTone}`} role="status">
          {posMessage(
            `pos.printJob.status.${latestJob.status}` as TranslationKey,
          )} · 第 {latestJob.attempt} 次
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
              {uncertainPrint ? "确认打印结果" : "重打"}
              {documentType === "receipt" ? "小票" : "标签"}
            </DialogTitle>
            <DialogDescription>
              {uncertainPrint
                ? "上次任务在打印中断开，系统无法判断是否已经出纸。请先检查打印机；确认需要再次打印后，由 Owner 或 Manager 填写原因授权，操作会写入审计记录。"
                : "已成功打印的文件再次打印需要 Owner 或 Manager 授权，原因和终端会写入审计记录。"}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            重打原因
            <Textarea
              className="min-h-24"
              disabled={busy}
              maxLength={500}
              onChange={(event) => setReprintReason(event.target.value)}
              placeholder="例如：客户要求补打一份"
              value={reprintReason}
            />
          </label>
          <DialogFooter>
            <Button
              className="h-10"
              disabled={busy}
              onClick={() => setReprintOpen(false)}
              type="button"
              variant="outline"
            >
              返回
            </Button>
            <Button
              className="h-10"
              disabled={busy || !reprintReason.trim()}
              onClick={() => void authorizeAndReprint()}
              type="button"
            >
              <Icon className="h-4 w-4" name="printer" />
              {busy ? "授权中" : "授权并重打"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
