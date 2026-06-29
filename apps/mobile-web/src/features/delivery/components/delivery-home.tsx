"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrintLocale } from "@cleanhub/hardware";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Clock3,
  CloudUpload,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  PenLine,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
  UserRound,
  WifiOff,
} from "lucide-react";

import { WorkspaceHeader } from "@/components/workspace-header";

import {
  getDeliveryQueueSummary,
  replayPendingDeliveryOperations,
  signDeliveryTask,
  updateDeliveryStatus,
  uploadDeliveryProof,
} from "../actions";
import { captureDeliveryPhoto, isOnline } from "../lib/device";
import type { UploadableMedia } from "../lib/media-upload";
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

type DeliveryHomeProps = {
  driverName?: string;
  isLoggingOut?: boolean;
  onLogout?: () => void;
};

type DataSource = "network" | "cache";

type CapturedProofPhoto = {
  media: UploadableMedia;
  capturedAt: string;
  previewUrl: string;
};

type DeliverySheet = "exception" | "proof" | "signature" | null;

type PrimaryTaskAction =
  | {
      kind: "status";
      status: DeliveryTaskStatus;
      labelKey: TranslationKey;
    }
  | {
      kind: "signature";
      labelKey: TranslationKey;
    };

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

function formatDateTime(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) {
    return emptyLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: string, locale: string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(numericValue);
}

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

function getPrimaryTaskAction(task: DeliveryTaskDetail): PrimaryTaskAction | null {
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
  driverName,
  isLoggingOut = false,
  onLogout = () => undefined,
}: DeliveryHomeProps) {
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];
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
  const [proofPhoto, setProofPhoto] = useState<CapturedProofPhoto | null>(null);
  const [signedByName, setSignedByName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printer, setPrinter] = useState(initialDeliveryPrinterState);
  const [isBooting, setIsBooting] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSigningRef = useRef(false);
  const hasSignatureRef = useRef(false);
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

      setMessage(t("delivery.messages.syncCount", { count: result.replayed.length }));
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
    setMessage(result.messageKey ? t(result.messageKey) : result.message ?? t("delivery.messages.statusUpdated"));

    if (result.result?.task) {
      replaceTask(result.result.task);
    }

    if (result.mode === "queued" && queuedStatus && result.queueItem) {
      applyQueuedStatus(result.queueItem.payload.taskId, queuedStatus);
    }

    void refreshQueue();
  }

  async function runAction(
    actionKey: string,
    action: () => Promise<void>,
  ): Promise<void> {
    setActiveAction(actionKey);
    setError(null);
    setMessage(null);
    setWarning(null);

    try {
      await action();
    } catch (nextError) {
      setError(getErrorMessage(nextError, t("delivery.messages.genericAction"), t));
    } finally {
      setActiveAction(null);
    }
  }

  function handleTaskSelect(taskId: string) {
    setSelectedTaskId(taskId);
    setSelectedTask(null);
    setDetailOpen(true);
    void runAction("detail", () => loadTaskDetail(taskId));
  }

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
        setMessage(t("delivery.proof.captured"));
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

      setMessage(
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
      setMessage(result.message);
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

      {queue.count > 0 ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-amber-900">
            <WifiOff className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t("delivery.queuePending", { count: queue.count })}
            </span>
          </div>
          <Button
            className="h-9 px-3"
            disabled={!canSync || activeAction === "sync"}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void replayQueue()}
          >
            {activeAction === "sync" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload className="size-4" aria-hidden="true" />
            )}
            {t("delivery.sync")}
          </Button>
        </div>
      ) : null}

      {dataSource === "cache" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("delivery.localData")}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {t("delivery.today")}
            </h2>
            <p className="text-sm text-slate-600">
              {t("delivery.taskCount", { count: orderedTasks.length })}
            </p>
          </div>
          <Button
            aria-label={t("common.refresh")}
            className="size-10 p-0"
            disabled={Boolean(activeAction)}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void runAction("refresh", () => refreshTasks(selectedTaskId))}
          >
            {activeAction === "refresh" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {orderedTasks.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {t("delivery.noTasks")}
            </div>
          ) : (
            orderedTasks.map((task) => {
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
                  onClick={() => handleTaskSelect(task.id)}
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

      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setActiveSheet(null);
          }
        }}
      >
        <SheetContent className="h-[92dvh] p-0">
          {selectedTask ? (
            <div className="flex h-full flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-2">
                <SheetHeader className="pr-8 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone[selectedTask.status]}`}
                    >
                      {t(statusLabelKeys[selectedTask.status])}
                    </span>
                    {selectedTaskPendingCount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                        {t("delivery.pendingSync", { count: selectedTaskPendingCount })}
                      </Badge>
                    ) : null}
                  </div>
                  <SheetTitle>{selectedTask.customerName}</SheetTitle>
                  <SheetDescription>
                    {formatDateTime(selectedTask.expectedAt, intlLocale, notScheduledLabel)}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="text-slate-700">
                      {formatDateTime(selectedTask.expectedAt, intlLocale, notScheduledLabel)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="text-slate-700">{selectedTask.address}</span>
                  </div>
                  {selectedTask.customerPhone ? (
                    <a
                      className="flex gap-3 text-sm text-blue-700"
                      href={`tel:${selectedTask.customerPhone}`}
                    >
                      <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{selectedTask.customerPhone}</span>
                    </a>
                  ) : null}
                  {selectedTask.notes ? (
                    <div className="flex gap-3">
                      <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <span className="text-slate-700">{selectedTask.notes}</span>
                    </div>
                  ) : null}
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs font-medium text-slate-500">{t("delivery.order")}</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
                      {selectedTask.order?.id ?? selectedTask.orderId ?? "-"}
                    </dd>
                    {selectedTask.order ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedTask.order.status} · {formatMoney(selectedTask.order.totalAmount, intlLocale)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs font-medium text-slate-500">{t("delivery.ticket")}</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
                      {selectedTask.ticket?.ticketNo ?? selectedTask.ticketId ?? "-"}
                    </dd>
                    {selectedTask.ticket ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedTask.ticket.ticketStatus}
                      </p>
                    ) : null}
                  </div>
                </dl>

                {selectedTaskProofImages.length > 0 ? (
                  <section className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-950">
                        {t("delivery.proof.savedTitle")}
                      </h3>
                      <span className="text-xs text-slate-500">
                        {t("delivery.proof.savedCount", {
                          count: selectedTaskProofImages.length,
                        })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTaskProofImages.map((proof) => (
                        <a
                          className="group overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                          href={proof.mediaUrl}
                          key={proof.id}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- Proof URLs are short-lived private media links. */}
                          <img
                            alt={t(proofTypeLabelKeys[proof.type])}
                            className="aspect-[4/3] w-full object-cover transition group-active:scale-[0.98]"
                            src={proof.mediaUrl}
                          />
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-600">
                            <span>{t(proofTypeLabelKeys[proof.type])}</span>
                            <span>{formatDateTime(proof.capturedAt ?? proof.createdAt, intlLocale, notScheduledLabel)}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedTaskCanUsePrinter ? (
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-blue-700">
                          <Printer className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">
                            {t("delivery.printer.title")}
                          </p>
                          <p className="truncate text-xs text-slate-600">
                            {printer.device?.name ??
                              printer.device?.id ??
                              (printer.status === "unavailable"
                                ? t("delivery.printer.unavailable")
                                : t("delivery.printer.notConnected"))}
                          </p>
                        </div>
                      </div>
                      <Button
                        aria-label={t("delivery.printer.connect")}
                        className="size-10 shrink-0 p-0"
                        disabled={Boolean(activeAction)}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={handleConnectPrinter}
                      >
                        {activeAction === "printer-connect" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        className="h-11"
                        disabled={Boolean(activeAction) || !printer.device}
                        type="button"
                        variant="secondary"
                        onClick={() => handlePrintDocument("receipt")}
                      >
                        {activeAction === "print-receipt" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ReceiptText className="size-4" aria-hidden="true" />
                        )}
                        {t("delivery.printer.receipt")}
                      </Button>
                      <Button
                        className="h-11"
                        disabled={Boolean(activeAction) || !printer.device}
                        type="button"
                        variant="secondary"
                        onClick={() => handlePrintDocument("label")}
                      >
                        {activeAction === "print-label" ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <PackageCheck className="size-4" aria-hidden="true" />
                        )}
                        {t("delivery.printer.label")}
                      </Button>
                    </div>
                  </section>
                ) : null}

                <div
                  className={`grid gap-2 ${
                    selectedTaskSecondaryActionCount > 1 ? "grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {selectedTaskCanUploadProof ? (
                    <Button
                      className="h-12"
                      type="button"
                      variant="outline"
                      onClick={() => openProofSheet(selectedTask)}
                    >
                      <Camera className="size-4" aria-hidden="true" />
                      {t("delivery.proof.title")}
                    </Button>
                  ) : null}
                  {selectedTaskCanReportException ? (
                    <Button
                      className="h-12"
                      type="button"
                      variant="outline"
                      onClick={() => setActiveSheet("exception")}
                    >
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      {t("delivery.exception.title")}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="sticky bottom-0 mt-auto space-y-3 border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <Navigation className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{t("delivery.workflow.title")}</p>
                    <p className="text-xs text-slate-600">{t(statusLabelKeys[selectedTask.status])}</p>
                  </div>
                </div>

                {selectedTaskTerminalMessageKey ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    {t(selectedTaskTerminalMessageKey)}
                  </p>
                ) : null}

                {primaryTaskAction?.kind === "status" ? (
                  <div className="space-y-2">
                    <Label htmlFor="status-note">{t("common.note")}</Label>
                    <Textarea
                      id="status-note"
                      className="min-h-16 text-base"
                      placeholder={t("common.optional")}
                      value={statusNote}
                      onChange={(event) => setStatusNote(event.target.value)}
                    />
                  </div>
                ) : null}

                {primaryTaskAction ? (
                  <div>
                    <Button
                      className="h-12 w-full"
                      disabled={Boolean(activeAction)}
                      type="button"
                      onClick={() => {
                        if (primaryTaskAction.kind === "signature") {
                          setActiveSheet("signature");
                          return;
                        }

                        handleStatusUpdate(primaryTaskAction.status);
                      }}
                    >
                      {primaryTaskAction.kind === "status" &&
                      activeAction === `status-${primaryTaskAction.status}` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : primaryTaskAction.kind === "signature" ? (
                        <PenLine className="size-4" aria-hidden="true" />
                      ) : (
                        <MapPin className="size-4" aria-hidden="true" />
                      )}
                      {t(primaryTaskAction.labelKey)}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[50dvh] items-center justify-center px-5 text-sm text-slate-600">
              <Loader2 className="mr-2 size-4 animate-spin text-blue-600" aria-hidden="true" />
              {t("delivery.detailLoading")}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "exception"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
          }
        }}
      >
        <SheetContent className="max-h-[72dvh] p-0">
          <form className="flex min-h-full flex-col" onSubmit={(event) => {
            event.preventDefault();
            handleException();
          }}>
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.exception.title")}</SheetTitle>
                <SheetDescription>{t("delivery.exception.description")}</SheetDescription>
              </SheetHeader>
              <div className="space-y-2">
                <Label htmlFor="exception-reason">{t("delivery.exception.reason")}</Label>
                <Textarea
                  id="exception-reason"
                  className="min-h-28 text-base"
                  value={exceptionReason}
                  onChange={(event) => setExceptionReason(event.target.value)}
                />
              </div>
            </div>
            <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12 w-full"
                disabled={Boolean(activeAction) || !exceptionReason.trim()}
                type="submit"
                variant="destructive"
              >
                {activeAction === "exception" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-4" aria-hidden="true" />
                )}
                {t("delivery.exception.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "proof"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
          }
        }}
      >
        <SheetContent className="max-h-[82dvh] p-0">
          <form className="flex min-h-full flex-col" onSubmit={handleProofSubmit}>
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.proof.title")}</SheetTitle>
                <SheetDescription>{t("delivery.proof.description")}</SheetDescription>
              </SheetHeader>

              {selectedTask ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-950">
                    {t("delivery.proof.forTask")}
                  </span>{" "}
                  {t(proofTypeLabelKeys[selectedTask.type])}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-12"
                    disabled={Boolean(activeAction)}
                    type="button"
                    variant="secondary"
                    onClick={() => handleCapturePhoto("camera")}
                  >
                    {activeAction === "camera" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="size-4" aria-hidden="true" />
                    )}
                    {proofPhoto ? t("delivery.proof.retake") : t("delivery.proof.capture")}
                  </Button>
                  <Button
                    className="h-12"
                    disabled={Boolean(activeAction)}
                    type="button"
                    variant="secondary"
                    onClick={() => handleCapturePhoto("gallery")}
                  >
                    {activeAction === "gallery" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="size-4" aria-hidden="true" />
                    )}
                    {t("delivery.proof.gallery")}
                  </Button>
                </div>

                {proofPhoto ? (
                  <div className="overflow-hidden rounded-md border border-emerald-200 bg-emerald-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Local blob previews cannot use Next image optimization. */}
                    <img
                      alt={t("delivery.proof.previewAlt")}
                      className="aspect-[4/3] w-full object-cover"
                      src={proofPhoto.previewUrl}
                    />
                    <p className="px-3 py-2 text-sm text-emerald-800">
                      {t("delivery.proof.captured")}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                    {t("delivery.proof.empty")}
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12 w-full"
                disabled={Boolean(activeAction) || !proofPhoto}
                type="submit"
              >
                {activeAction === "proof" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PackageCheck className="size-4" aria-hidden="true" />
                )}
                {t("delivery.proof.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={activeSheet === "signature"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSheet(null);
            clearSignature();
          }
        }}
      >
        <SheetContent className="max-h-[86dvh] p-0">
          <form className="flex min-h-full flex-col" onSubmit={handleSignatureSubmit}>
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.signature.title")}</SheetTitle>
                <SheetDescription>{t("delivery.signature.description")}</SheetDescription>
              </SheetHeader>

              <div className="space-y-2">
                <Label htmlFor="signed-by">{t("delivery.signature.signer")}</Label>
                <Input
                  id="signed-by"
                  className="h-12 text-base"
                  value={signedByName}
                  onChange={(event) => setSignedByName(event.target.value)}
                />
              </div>

              <canvas
                aria-label={t("delivery.signature.canvasLabel")}
                className="h-44 w-full touch-none rounded-md border border-slate-300 bg-white"
                height={260}
                ref={signatureCanvasRef}
                width={680}
                onPointerCancel={endSignature}
                onPointerDown={beginSignature}
                onPointerLeave={endSignature}
                onPointerMove={drawSignature}
                onPointerUp={endSignature}
              />
            </div>
            <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12"
                disabled={!hasSignature || Boolean(activeAction)}
                type="button"
                variant="secondary"
                onClick={clearSignature}
              >
                {t("delivery.signature.clear")}
              </Button>
              <Button className="h-12" disabled={Boolean(activeAction)} type="submit">
                {activeAction === "signature" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserRound className="size-4" aria-hidden="true" />
                )}
                {t("delivery.signature.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
