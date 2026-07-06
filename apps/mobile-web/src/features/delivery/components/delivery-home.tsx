"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrintLocale } from "@cleanhub/hardware";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { toast } from "@cleanhub/ui";
import { Loader2 } from "lucide-react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { resolveTenantCurrency } from "@/lib/currency";
import {
  readMobileDetailUrlState,
  writeMobileDetailUrlState,
} from "@/lib/detail-url";

import {
  getDeliveryQueueSummary,
  replayPendingDeliveryOperations,
  signDeliveryTask,
  updateDeliveryStatus,
  uploadDeliveryProof,
} from "../actions";
import { captureDeliveryPhoto, isOnline } from "../lib/device";
import {
  connectPortablePrinter,
  initialDeliveryPrinterState,
  printDeliveryDocument,
  validateDeliveryPrintTask,
  type DeliveryPrintDocument,
} from "../lib/printing";
import { getDeliveryTaskDetail, getTodayDeliveryTasks } from "../queries";
import type {
  DeliveryActionResult,
  DeliveryProofType,
  DeliveryQueueSummary,
  DeliveryTaskDetail,
  DeliveryTaskListItem,
  DeliveryTaskStatus,
} from "../types";
import {
  DeliveryMessageBanner,
  DeliveryQueueBanner,
  DeliveryTaskList,
} from "./delivery-task-list";
import {
  DeliveryTaskActionSheets,
  type DeliveryCapturedProofPhoto,
  type DeliverySheet,
} from "./delivery-task-action-sheets";
import {
  DeliveryTaskDetailSheet,
  type DeliveryPrimaryTaskAction,
} from "./delivery-task-detail-sheet";

type DeliveryHomeProps = {
  currency?: string;
  driverName?: string;
  isLoggingOut?: boolean;
  onLogout?: () => void;
};

type DataSource = "network" | "cache";

const statusTone: Record<DeliveryTaskStatus, string> = {
  pending_dispatch: "border-amber-200 bg-amber-50 text-amber-800",
  en_route: "border-sky-200 bg-sky-50 text-sky-800",
  arrived: "border-cyan-200 bg-cyan-50 text-cyan-800",
  picked_up: "border-indigo-200 bg-indigo-50 text-indigo-800",
  delivering: "border-violet-200 bg-violet-50 text-violet-800",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  exception: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusLabelKeys: Record<DeliveryTaskStatus, TranslationKey> = {
  pending_dispatch: "delivery.status.pending_dispatch",
  en_route: "delivery.status.en_route",
  arrived: "delivery.status.arrived",
  picked_up: "delivery.status.picked_up",
  delivering: "delivery.status.delivering",
  signed: "delivery.status.signed",
  exception: "delivery.status.exception",
  cancelled: "delivery.status.cancelled",
};

const nextStatusOptions = {
  pending_dispatch: [{ status: "en_route", labelKey: "delivery.nextStatus.en_route" }],
  en_route: [{ status: "arrived", labelKey: "delivery.nextStatus.arrived" }],
  arrived: [{ status: "picked_up", labelKey: "delivery.nextStatus.picked_up" }],
  picked_up: [{ status: "delivering", labelKey: "delivery.nextStatus.delivering" }],
  delivering: [],
  signed: [],
  exception: [],
  cancelled: [],
} satisfies Record<
  DeliveryTaskStatus,
  { status: DeliveryTaskStatus; labelKey: TranslationKey }[]
>;

const terminalStatusMessageKeys: Record<DeliveryTaskStatus, TranslationKey | null> = {
  pending_dispatch: null,
  en_route: null,
  arrived: null,
  picked_up: null,
  delivering: null,
  signed: "delivery.workflow.signedDone",
  exception: "delivery.workflow.exceptionLocked",
  cancelled: "delivery.workflow.cancelled",
};

const proofEnabledStatuses: readonly DeliveryTaskStatus[] = [
  "arrived",
  "picked_up",
  "delivering",
] as const;

const proofTypeLabelKeys = {
  pickup: "delivery.type.pickup",
  dropoff: "delivery.type.dropoff",
  signature: "delivery.type.signature",
} satisfies Record<DeliveryProofType, TranslationKey>;

const intlLocales: Record<PrintLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
  "zh-CN": "zh-CN",
};

const deliveryDetailUrlViews = ["task"] as const;

function getErrorMessage(error: unknown, fallback: string, t: ReturnType<typeof useTranslation>["t"]): string {
  if (error instanceof Error) {
    if (error.message.startsWith("delivery.")) {
      return t(error.message as TranslationKey);
    }

    return error.message;
  }

  if (typeof error === "string") {
    if (error.startsWith("delivery.")) {
      return t(error as TranslationKey);
    }

    return error;
  }

  return fallback;
}

function getTaskPendingCount(
  queue: DeliveryQueueSummary,
  taskId: string,
): number {
  return queue.items.filter(
    (item) => item.status === "pending" && item.payload.taskId === taskId,
  ).length;
}

function asListItem(task: DeliveryTaskDetail): DeliveryTaskListItem {
  return {
    id: task.id,
    tenantId: task.tenantId,
    branchId: task.branchId,
    appointmentId: task.appointmentId,
    assigneeUserId: task.assigneeUserId,
    assigneeName: task.assigneeName,
    type: task.type,
    status: task.status,
    expectedAt: task.expectedAt,
    customerName: task.customerName,
    customerPhone: task.customerPhone,
    address: task.address,
    orderId: task.orderId,
    ticketId: task.ticketId,
    updatedAt: task.updatedAt,
  };
}

function applyStatusToTask<TTask extends DeliveryTaskListItem | DeliveryTaskDetail>(
  task: TTask,
  status: DeliveryTaskStatus,
): TTask {
  return {
    ...task,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function isTerminalStatus(status: DeliveryTaskStatus): boolean {
  return terminalStatusMessageKeys[status] !== null;
}

function canUploadProofForStatus(status: DeliveryTaskStatus): boolean {
  return proofEnabledStatuses.includes(status);
}

function canUsePrinterForStatus(status: DeliveryTaskStatus): boolean {
  return status === "signed" || proofEnabledStatuses.includes(status);
}

function canRequestSignatureForStatus(status: DeliveryTaskStatus): boolean {
  return status === "delivering";
}

function canReportExceptionForStatus(status: DeliveryTaskStatus): boolean {
  return !isTerminalStatus(status);
}

function getPrimaryTaskAction(task: DeliveryTaskDetail): DeliveryPrimaryTaskAction | null {
  if (canRequestSignatureForStatus(task.status)) {
    return {
      kind: "signature",
      labelKey: "delivery.signature.submit",
    };
  }

  const [nextStatus] = nextStatusOptions[task.status];

  return nextStatus
    ? {
        kind: "status",
        status: nextStatus.status,
        labelKey: nextStatus.labelKey,
      }
    : null;
}

export function DeliveryHome({
  currency,
  driverName,
  isLoggingOut = false,
  onLogout = () => undefined,
}: DeliveryHomeProps) {
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];
  const tenantCurrency = resolveTenantCurrency(currency);
  const notScheduledLabel = t("common.notScheduled");
  const printMessages = useMemo(
    () => ({
      connectFirst: t("delivery.printer.connectFirst"),
      missingDocument: t("delivery.printer.missingDocument"),
      missingInfo: t("delivery.printer.missingInfo"),
      popupBlocked: t("delivery.printer.popupBlocked"),
      readyLabel: t("delivery.printer.readyLabel"),
      readyReceipt: t("delivery.printer.readyReceipt"),
      webUnavailable: t("delivery.printer.webUnavailable"),
    }),
    [t],
  );
  const [tasks, setTasks] = useState<DeliveryTaskListItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<DeliveryTaskDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<DeliverySheet>(null);
  const [dataSource, setDataSource] = useState<DataSource>("network");
  const [queue, setQueue] = useState<DeliveryQueueSummary>({
    count: 0,
    items: [],
  });
  const [statusNote, setStatusNote] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [proofType, setProofType] =
    useState<Exclude<DeliveryProofType, "signature">>("pickup");
  const [proofPhoto, setProofPhoto] = useState<DeliveryCapturedProofPhoto | null>(null);
  const [signedByName, setSignedByName] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printer, setPrinter] = useState(initialDeliveryPrinterState);
  const [isBooting, setIsBooting] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSigningRef = useRef(false);
  const hasSignatureRef = useRef(false);
  const hasRestoredDetailRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const selectedTaskPendingCount = selectedTask
    ? getTaskPendingCount(queue, selectedTask.id)
    : 0;
  const canSync = queue.count > 0 && isOnline();

  const orderedTasks = useMemo(
    () =>
      [...tasks].sort((first, second) => {
        const firstTime = first.expectedAt
          ? new Date(first.expectedAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const secondTime = second.expectedAt
          ? new Date(second.expectedAt).getTime()
          : Number.MAX_SAFE_INTEGER;

        return firstTime - secondTime;
      }),
    [tasks],
  );

  const replaceTask = useCallback((task: DeliveryTaskDetail) => {
    setSelectedTask(task);
    setSelectedTaskId(task.id);
    setTasks((currentTasks) => {
      const nextListItem = asListItem(task);

      if (currentTasks.some((currentTask) => currentTask.id === task.id)) {
        return currentTasks.map((currentTask) =>
          currentTask.id === task.id ? nextListItem : currentTask,
        );
      }

      return [nextListItem, ...currentTasks];
    });
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueue(await getDeliveryQueueSummary());
  }, []);

  const loadTaskDetail = useCallback(
    async (taskId: string) => {
      const response = await getDeliveryTaskDetail(taskId);
      setDataSource(response.source);
      replaceTask(response.task);
    },
    [replaceTask],
  );

  const refreshTasks = useCallback(
    async (preferredTaskId?: string | null) => {
      const response = await getTodayDeliveryTasks();
      setDataSource(response.source);
      setTasks(response.tasks);

      const nextTaskId =
        (preferredTaskId &&
          response.tasks.some((task) => task.id === preferredTaskId) &&
          preferredTaskId) ||
        null;

      setSelectedTaskId(nextTaskId);

      if (nextTaskId) {
        await loadTaskDetail(nextTaskId);
      } else {
        setSelectedTask(null);
      }
    },
    [loadTaskDetail],
  );

  const boot = useCallback(async () => {
    try {
      await Promise.all([refreshTasks(null), refreshQueue()]);
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("delivery.messages.loadFailed"), t));
    } finally {
      setIsBooting(false);
    }
  }, [refreshQueue, refreshTasks, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void boot();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [boot]);

  useEffect(
    () => () => {
      if (proofPhoto) {
        URL.revokeObjectURL(proofPhoto.previewUrl);
      }
    },
    [proofPhoto],
  );

  const replayQueue = useCallback(async () => {
    if (!isOnline()) {
      setWarning(t("delivery.messages.networkUnavailable"));
      return;
    }

    setActiveAction("sync");
    setError(null);
    setWarning(null);

    try {
      const result = await replayPendingDeliveryOperations();
      await refreshQueue();

      if (selectedTaskId) {
        await refreshTasks(selectedTaskId);
      }

      if (result.failed) {
        setWarning(
          t("delivery.messages.syncPartial", { count: result.replayed.length }),
        );
        return;
      }

      toast.success(t("delivery.messages.syncCount", { count: result.replayed.length }));
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("delivery.messages.genericAction"), t));
    } finally {
      setActiveAction(null);
    }
  }, [refreshQueue, refreshTasks, selectedTaskId, t]);

  useEffect(() => {
    function handleOnline() {
      void replayQueue();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [replayQueue]);

  function applyQueuedStatus(taskId: string, status: DeliveryTaskStatus) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? applyStatusToTask(task, status) : task,
      ),
    );
    setSelectedTask((currentTask) =>
      currentTask?.id === taskId ? applyStatusToTask(currentTask, status) : currentTask,
    );
  }

  function handleActionResult(
    result: DeliveryActionResult,
    queuedStatus?: DeliveryTaskStatus,
  ) {
    toast.success(
      result.messageKey
        ? t(result.messageKey)
        : result.message ?? t("delivery.messages.statusUpdated"),
    );

    if (result.result?.task) {
      replaceTask(result.result.task);
    }

    if (result.mode === "queued" && queuedStatus && result.queueItem) {
      applyQueuedStatus(result.queueItem.payload.taskId, queuedStatus);
    }

    void refreshQueue();
  }

  const runAction = useCallback(async (
    actionKey: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setActiveAction(actionKey);
    setError(null);
    setWarning(null);

    try {
      await action();
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("delivery.messages.genericAction"), t));
    } finally {
      setActiveAction(null);
    }
  }, [t]);

  const closeTaskDetail = useCallback((syncUrl = true) => {
    setDetailOpen(false);
    setActiveSheet(null);
    setSelectedTaskId(null);
    setSelectedTask(null);

    if (syncUrl) {
      writeMobileDetailUrlState(null, "replace");
    }
  }, [setActiveSheet]);

  const openTaskDetail = useCallback((
    taskId: string,
    options: { syncUrl?: boolean } = {},
  ) => {
    if (options.syncUrl ?? true) {
      writeMobileDetailUrlState({ view: "task", id: taskId }, "push");
    }

    setSelectedTaskId(taskId);
    setSelectedTask(null);
    setDetailOpen(true);
    void runAction("detail", async () => {
      try {
        await loadTaskDetail(taskId);
      } catch (nextError) {
        closeTaskDetail(false);
        writeMobileDetailUrlState(null, "replace");
        throw new Error(
          getErrorMessage(
            nextError,
            t("delivery.messages.detailUnavailable"),
            t,
          ),
        );
      }
    });
  }, [closeTaskDetail, loadTaskDetail, runAction, t]);

  function handleTaskSelect(taskId: string) {
    openTaskDetail(taskId);
  }

  useEffect(() => {
    if (isBooting || hasRestoredDetailRef.current) {
      return;
    }

    hasRestoredDetailRef.current = true;
    const detailState = readMobileDetailUrlState(deliveryDetailUrlViews);

    if (detailState) {
      const restoreTimeoutId = window.setTimeout(() => {
        openTaskDetail(detailState.id, { syncUrl: false });
      }, 0);

      return () => window.clearTimeout(restoreTimeoutId);
    }
  }, [isBooting, openTaskDetail]);

  useEffect(() => {
    function handlePopState() {
      const detailState = readMobileDetailUrlState(deliveryDetailUrlViews);

      if (!detailState) {
        closeTaskDetail(false);
        return;
      }

      openTaskDetail(detailState.id, { syncUrl: false });
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeTaskDetail, openTaskDetail]);

  function openProofSheet(task: DeliveryTaskDetail) {
    if (!canUploadProofForStatus(task.status)) {
      return;
    }

    setProofType(task.type);
    setProofPhoto((currentPhoto) => {
      if (currentPhoto) {
        URL.revokeObjectURL(currentPhoto.previewUrl);
      }

      return null;
    });
    setActiveSheet("proof");
  }

  function handleStatusUpdate(toStatus: DeliveryTaskStatus) {
    if (!selectedTask) {
      return;
    }

    void runAction(`status-${toStatus}`, async () => {
      const result = await updateDeliveryStatus({
        taskId: selectedTask.id,
        toStatus,
        note: statusNote,
      });

      if (result.gpsWarningKey || result.gpsWarning) {
        setWarning(result.gpsWarningKey ? t(result.gpsWarningKey) : result.gpsWarning ?? null);
      }

      setStatusNote("");
      handleActionResult(result, toStatus);
    });
  }

  function handleException() {
    if (!selectedTask) {
      return;
    }

    void runAction("exception", async () => {
      const result = await updateDeliveryStatus({
        taskId: selectedTask.id,
        toStatus: "exception",
        exceptionReason,
      });

      if (result.gpsWarningKey || result.gpsWarning) {
        setWarning(result.gpsWarningKey ? t(result.gpsWarningKey) : result.gpsWarning ?? null);
      }

      setExceptionReason("");
      handleActionResult(result, "exception");
      setActiveSheet(null);
    });
  }

  function handleCapturePhoto(source: "camera" | "gallery") {
    void runAction(source, async () => {
      const result = await captureDeliveryPhoto(source);

      if (result.warningKey || result.warning) {
        setWarning(result.warningKey ? t(result.warningKey) : result.warning ?? null);
      }

      if (result.photo) {
        const photo = result.photo;
        const previewUrl = URL.createObjectURL(photo.blob);

        setProofPhoto((currentPhoto) => {
          if (currentPhoto) {
            URL.revokeObjectURL(currentPhoto.previewUrl);
          }

          return {
            media: {
              blob: photo.blob,
              contentType: photo.contentType,
              capturedAt: photo.capturedAt,
            },
            capturedAt: photo.capturedAt,
            previewUrl,
          };
        });
        toast.success(t("delivery.proof.captured"));
      }
    });
  }

  function handleProofSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTask) {
      return;
    }

    if (!proofPhoto) {
      setError(t("delivery.messages.proofMediaRequired"));
      return;
    }

    void runAction("proof", async () => {
      const result = await uploadDeliveryProof({
        taskId: selectedTask.id,
        type: proofType,
        media: proofPhoto.media,
        capturedAt: proofPhoto.capturedAt,
      });

      setProofPhoto((currentPhoto) => {
        if (currentPhoto) {
          URL.revokeObjectURL(currentPhoto.previewUrl);
        }

        return null;
      });
      handleActionResult(result);
      setActiveSheet(null);
    });
  }

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const point = getCanvasPoint(event);

    if (!canvas || !point) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.beginPath();
    context.moveTo(point.x, point.y);
    isSigningRef.current = true;
    hasSignatureRef.current = true;
    setHasSignature(true);
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isSigningRef.current) {
      return;
    }

    const canvas = signatureCanvasRef.current;
    const point = getCanvasPoint(event);

    if (!canvas || !point) {
      return;
    }

    event.preventDefault();
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#2563eb";
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    isSigningRef.current = false;
    canvas?.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    hasSignatureRef.current = false;
    setHasSignature(false);
  }

  function handleSignatureSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTask) {
      return;
    }

    const canvas = signatureCanvasRef.current;

    if (!canvas || !hasSignatureRef.current) {
      setError(t("delivery.messages.signatureRequired"));
      return;
    }

    void runAction("signature", async () => {
      const signatureBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error(t("delivery.messages.signaturePrepareFailed")));
        }, "image/png");
      });
      const result = await signDeliveryTask({
        taskId: selectedTask.id,
        signatureMedia: {
          blob: signatureBlob,
          contentType: "image/png",
          capturedAt: new Date().toISOString(),
        },
        capturedAt: new Date().toISOString(),
        signedByName,
      });

      if (result.gpsWarningKey || result.gpsWarning) {
        setWarning(result.gpsWarningKey ? t(result.gpsWarningKey) : result.gpsWarning ?? null);
      }

      clearSignature();
      setSignedByName("");
      handleActionResult(result, "signed");
      setActiveSheet(null);
    });
  }

  function handleConnectPrinter() {
    void runAction("printer-connect", async () => {
      const nextPrinter = await connectPortablePrinter(printMessages);
      setPrinter(nextPrinter);

      if (nextPrinter.error) {
        setWarning(nextPrinter.error);
        return;
      }

      toast.success(
        nextPrinter.device?.name
          ? t("delivery.printer.connectedDevice", { name: nextPrinter.device.name })
          : t("delivery.printer.connected"),
      );
    });
  }

  function handlePrintDocument(document: DeliveryPrintDocument) {
    if (!selectedTask) {
      return;
    }

    const validationError = validateDeliveryPrintTask(selectedTask, printMessages);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!printer.device) {
      setWarning(t("delivery.printer.connectFirst"));
      return;
    }

    void runAction(`print-${document}`, async () => {
      const result = await printDeliveryDocument({
        task: selectedTask,
        document,
        locale,
        messages: printMessages,
        printer,
      });
      toast.success(result.message);
    });
  }

  const primaryTaskAction = selectedTask ? getPrimaryTaskAction(selectedTask) : null;
  const selectedTaskCanReportException = selectedTask
    ? canReportExceptionForStatus(selectedTask.status)
    : false;
  const selectedTaskCanUploadProof = selectedTask
    ? canUploadProofForStatus(selectedTask.status)
    : false;
  const selectedTaskCanUsePrinter = selectedTask
    ? canUsePrinterForStatus(selectedTask.status)
    : false;
  const selectedTaskTerminalMessageKey = selectedTask
    ? terminalStatusMessageKeys[selectedTask.status]
    : null;
  const selectedTaskProofImages =
    selectedTask?.proofs.filter((proof) => Boolean(proof.mediaUrl)) ?? [];
  const selectedTaskSecondaryActionCount =
    Number(selectedTaskCanUploadProof) +
    Number(selectedTaskCanReportException);

  if (isBooting) {
    return (
      <section className="flex min-h-[70dvh] items-center justify-center px-5">
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
          {t("delivery.loading")}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(20px,env(safe-area-inset-top))]">
      <WorkspaceHeader
        eyebrow={t("delivery.title")}
        isLoggingOut={isLoggingOut}
        logoutLabel={t("auth.logout")}
        subtitle={driverName}
        title={t("delivery.subtitle")}
        onLogout={onLogout}
      />

      <DeliveryQueueBanner
        canSync={canSync}
        count={queue.count}
        isSyncing={activeAction === "sync"}
        onSync={() => void replayQueue()}
      />

      {dataSource === "cache" ? (
        <DeliveryMessageBanner message={t("delivery.localData")} tone="cache" />
      ) : null}
      {error ? (
        <DeliveryMessageBanner message={error} tone="error" />
      ) : null}
      {warning ? (
        <DeliveryMessageBanner message={warning} tone="warning" />
      ) : null}

      <DeliveryTaskList
        activeAction={activeAction}
        queue={queue}
        selectedTaskId={selectedTaskId}
        statusLabelKeys={statusLabelKeys}
        statusTone={statusTone}
        tasks={orderedTasks}
        onRefresh={() => void runAction("refresh", () => refreshTasks(selectedTaskId))}
        onSelectTask={handleTaskSelect}
      />

      <DeliveryTaskDetailSheet
        activeAction={activeAction}
        intlLocale={intlLocale}
        notScheduledLabel={notScheduledLabel}
        open={detailOpen}
        primaryTaskAction={primaryTaskAction}
        printer={printer}
        proofTypeLabelKeys={proofTypeLabelKeys}
        selectedTask={selectedTask}
        selectedTaskCanReportException={selectedTaskCanReportException}
        selectedTaskCanUploadProof={selectedTaskCanUploadProof}
        selectedTaskCanUsePrinter={selectedTaskCanUsePrinter}
        selectedTaskPendingCount={selectedTaskPendingCount}
        selectedTaskProofImages={selectedTaskProofImages}
        selectedTaskSecondaryActionCount={selectedTaskSecondaryActionCount}
        selectedTaskTerminalMessageKey={selectedTaskTerminalMessageKey}
        statusLabelKeys={statusLabelKeys}
        statusNote={statusNote}
        statusTone={statusTone}
        tenantCurrency={tenantCurrency}
        onConnectPrinter={handleConnectPrinter}
        onOpenChange={(open) => {
          if (!open) {
            closeTaskDetail();
          } else {
            setDetailOpen(true);
          }
        }}
        onOpenExceptionSheet={() => setActiveSheet("exception")}
        onOpenProofSheet={openProofSheet}
        onPrintDocument={handlePrintDocument}
        onPrimaryStatusUpdate={handleStatusUpdate}
        onRequestSignature={() => setActiveSheet("signature")}
        onStatusNoteChange={setStatusNote}
      />

      <DeliveryTaskActionSheets
        activeAction={activeAction}
        exceptionOpen={activeSheet === "exception"}
        exceptionReason={exceptionReason}
        hasSignature={hasSignature}
        proofOpen={activeSheet === "proof"}
        proofPhoto={proofPhoto}
        proofTypeLabelKeys={proofTypeLabelKeys}
        selectedTask={selectedTask}
        signatureCanvasRef={signatureCanvasRef}
        signatureOpen={activeSheet === "signature"}
        signedByName={signedByName}
        onBeginSignature={beginSignature}
        onCapturePhoto={handleCapturePhoto}
        onClearSignature={clearSignature}
        onDrawSignature={drawSignature}
        onEndSignature={endSignature}
        onExceptionOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
          }
        }}
        onExceptionReasonChange={setExceptionReason}
        onExceptionSubmit={handleException}
        onProofOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
          }
        }}
        onProofSubmit={handleProofSubmit}
        onSignatureOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
            clearSignature();
          }
        }}
        onSignatureSubmit={handleSignatureSubmit}
        onSignedByNameChange={setSignedByName}
      />
    </section>
  );
}
