"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudUpload,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  PenLine,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
  Route,
  UserRound,
  WifiOff,
} from "lucide-react";

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
};

type DataSource = "network" | "cache";

type CapturedProofPhoto = {
  media: UploadableMedia;
  capturedAt: string;
};

type DeliverySheet = "exception" | "proof" | "signature" | null;

const statusLabels: Record<DeliveryTaskStatus, string> = {
  pending_dispatch: "A préparer",
  en_route: "En route",
  arrived: "Sur place",
  picked_up: "Collecté",
  delivering: "En livraison",
  signed: "Signé",
  exception: "Exception",
  cancelled: "Annulé",
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

const taskTypeLabels = {
  pickup: "Collecte",
  dropoff: "Livraison",
} satisfies Record<DeliveryTaskListItem["type"], string>;

const nextStatusOptions = {
  pending_dispatch: [{ status: "en_route", label: "Départ" }],
  en_route: [{ status: "arrived", label: "Arrivée" }],
  arrived: [{ status: "picked_up", label: "Collecter" }],
  picked_up: [{ status: "delivering", label: "Livrer" }],
  delivering: [],
  signed: [],
  exception: [],
  cancelled: [],
} satisfies Record<
  DeliveryTaskStatus,
  { status: DeliveryTaskStatus; label: string }[]
>;

const proofTypeLabels = {
  pickup: "Collecte",
  dropoff: "Livraison",
  signature: "Signature",
} satisfies Record<DeliveryProofType, string>;

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Non planifié";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: string): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(numericValue);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Action impossible pour le moment.";
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

export function DeliveryHome({ driverName }: DeliveryHomeProps) {
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
  const [proofMediaRef, setProofMediaRef] = useState("");
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
      setError(getErrorMessage(nextError));
    } finally {
      setIsBooting(false);
    }
  }, [refreshQueue, refreshTasks]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void boot();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [boot]);

  const replayQueue = useCallback(async () => {
    if (!isOnline()) {
      setWarning("Réseau indisponible. Les actions restent en attente.");
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
          `Synchronisation partielle: ${result.replayed.length} action(s), puis échec.`,
        );
        return;
      }

      setMessage(`${result.replayed.length} action(s) synchronisée(s).`);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setActiveAction(null);
    }
  }, [refreshQueue, refreshTasks, selectedTaskId]);

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
    setMessage(result.message);

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
      setError(getErrorMessage(nextError));
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

      if (result.gpsWarning) {
        setWarning(result.gpsWarning);
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

      if (result.gpsWarning) {
        setWarning(result.gpsWarning);
      }

      setExceptionReason("");
      handleActionResult(result, "exception");
      setActiveSheet(null);
    });
  }

  function handleCapturePhoto() {
    void runAction("camera", async () => {
      const result = await captureDeliveryPhoto();

      if (result.warning) {
        setWarning(result.warning);
      }

      if (result.photo) {
        setProofPhoto({
          media: {
            blob: result.photo.blob,
            contentType: result.photo.contentType,
            capturedAt: result.photo.capturedAt,
          },
          capturedAt: result.photo.capturedAt,
        });
        setMessage("Photo prête à envoyer.");
      }
    });
  }

  function handleProofSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTask) {
      return;
    }

    if (!proofPhoto && !proofMediaRef.trim()) {
      setError("Ajoutez une photo ou une référence de preuve.");
      return;
    }

    void runAction("proof", async () => {
      const result = await uploadDeliveryProof({
        taskId: selectedTask.id,
        type: proofType,
        media: proofPhoto?.media,
        capturedAt: proofPhoto?.capturedAt,
        mediaRef: proofMediaRef,
      });

      setProofPhoto(null);
      setProofMediaRef("");
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
    context.strokeStyle = "#0f766e";
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
      setError("Signature client requise.");
      return;
    }

    void runAction("signature", async () => {
      const signatureBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error("Signature impossible à préparer."));
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

      if (result.gpsWarning) {
        setWarning(result.gpsWarning);
      }

      clearSignature();
      setSignedByName("");
      handleActionResult(result, "signed");
      setActiveSheet(null);
    });
  }

  function handleConnectPrinter() {
    void runAction("printer-connect", async () => {
      const nextPrinter = await connectPortablePrinter();
      setPrinter(nextPrinter);

      if (nextPrinter.error) {
        setWarning(nextPrinter.error);
        return;
      }

      setMessage(
        nextPrinter.device?.name
          ? `Imprimante connectee: ${nextPrinter.device.name}`
          : "Imprimante connectee.",
      );
    });
  }

  function handlePrintDocument(document: DeliveryPrintDocument) {
    if (!selectedTask) {
      return;
    }

    const validationError = validateDeliveryPrintTask(selectedTask);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!printer.device) {
      setWarning("Connectez une imprimante portable avant d'imprimer.");
      return;
    }

    void runAction(`print-${document}`, async () => {
      const result = await printDeliveryDocument({
        task: selectedTask,
        document,
        printer,
      });
      setMessage(result.message);
    });
  }

  if (isBooting) {
    return (
      <section className="flex min-h-[70dvh] items-center justify-center px-5">
        <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden="true" />
          Chargement de la tournée
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(20px,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Livraison
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            Tournée du jour
          </h1>
          {driverName ? (
            <p className="mt-1 truncate text-sm text-slate-600">{driverName}</p>
          ) : null}
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white shadow-sm">
          <Route className="size-5" aria-hidden="true" />
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
          {queue.count > 0 ? (
            <WifiOff className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
          )}
          <span className="truncate">
            {queue.count > 0
              ? `${queue.count} en attente de sync`
              : "Aucune action en attente"}
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
          Sync
        </Button>
      </div>

      {dataSource === "cache" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Données locales affichées.
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
        <p className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Aujourd&apos;hui</h2>
            <p className="text-sm text-slate-600">
              {orderedTasks.length} tâche(s)
            </p>
          </div>
          <Button
            className="h-10 px-3"
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
              Aucune tâche assignée pour aujourd&apos;hui.
            </div>
          ) : (
            orderedTasks.map((task) => {
              const pendingCount = getTaskPendingCount(queue, task.id);
              const isSelected = task.id === selectedTaskId;

              return (
                <button
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-teal-700 bg-teal-50"
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
                      {statusLabels[task.status]}
                    </span>
                    <Badge variant="outline">{taskTypeLabels[task.type]}</Badge>
                    {pendingCount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                        {pendingCount} à synchroniser
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
            <div className="flex min-h-full flex-col">
              <div className="space-y-5 px-5 pb-4 pt-2">
                <SheetHeader className="pr-8 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone[selectedTask.status]}`}
                    >
                      {statusLabels[selectedTask.status]}
                    </span>
                    <Badge variant="outline">{taskTypeLabels[selectedTask.type]}</Badge>
                    {selectedTaskPendingCount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-900" variant="secondary">
                        {selectedTaskPendingCount} à synchroniser
                      </Badge>
                    ) : null}
                  </div>
                  <SheetTitle>{selectedTask.customerName}</SheetTitle>
                  <SheetDescription>
                    {formatDateTime(selectedTask.expectedAt)}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="text-slate-700">
                      {formatDateTime(selectedTask.expectedAt)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="text-slate-700">{selectedTask.address}</span>
                  </div>
                  {selectedTask.customerPhone ? (
                    <a
                      className="flex gap-3 text-sm text-teal-800"
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
                    <dt className="text-xs font-medium text-slate-500">Commande</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
                      {selectedTask.order?.id ?? selectedTask.orderId ?? "-"}
                    </dd>
                    {selectedTask.order ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedTask.order.status} · {formatMoney(selectedTask.order.totalAmount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <dt className="text-xs font-medium text-slate-500">Ticket</dt>
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

                <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-teal-700">
                        <Printer className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">Imprimante</p>
                        <p className="truncate text-xs text-slate-600">
                          {printer.device?.name ??
                            printer.device?.id ??
                            (printer.status === "unavailable" ? "Bluetooth indisponible" : "Non connectee")}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="h-10 shrink-0 px-3"
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
                      Recu
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
                      Etiquette
                    </Button>
                  </div>
                </section>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    className="h-12 flex-col gap-1 text-xs"
                    type="button"
                    variant="outline"
                    onClick={() => setActiveSheet("exception")}
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    Exception
                  </Button>
                  <Button
                    className="h-12 flex-col gap-1 text-xs"
                    type="button"
                    variant="outline"
                    onClick={() => setActiveSheet("proof")}
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Photo
                  </Button>
                  <Button
                    className="h-12 flex-col gap-1 text-xs"
                    type="button"
                    variant="outline"
                    onClick={() => setActiveSheet("signature")}
                  >
                    <PenLine className="size-4" aria-hidden="true" />
                    Signature
                  </Button>
                </div>
              </div>

              <div className="sticky bottom-0 mt-auto space-y-3 border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                    <Navigation className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Statut</p>
                    <p className="text-xs text-slate-600">{statusLabels[selectedTask.status]}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status-note">Note</Label>
                  <Textarea
                    id="status-note"
                    className="min-h-16 text-base"
                    placeholder="Optionnel"
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {nextStatusOptions[selectedTask.status].map((option) => (
                    <Button
                      className="h-12"
                      disabled={Boolean(activeAction)}
                      key={option.status}
                      type="button"
                      onClick={() => handleStatusUpdate(option.status)}
                    >
                      {activeAction === `status-${option.status}` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <MapPin className="size-4" aria-hidden="true" />
                      )}
                      {option.label}
                    </Button>
                  ))}
                  {nextStatusOptions[selectedTask.status].length === 0 ? (
                    <div className="col-span-2 rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                      Aucun passage de statut disponible.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[50dvh] items-center justify-center px-5 text-sm text-slate-600">
              <Loader2 className="mr-2 size-4 animate-spin text-teal-700" aria-hidden="true" />
              Chargement du détail
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
                <SheetTitle>Exception</SheetTitle>
                <SheetDescription>Indiquez le motif avant de bloquer la tâche.</SheetDescription>
              </SheetHeader>
              <div className="space-y-2">
                <Label htmlFor="exception-reason">Motif</Label>
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
                Marquer exception
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
                <SheetTitle>Preuve photo</SheetTitle>
                <SheetDescription>Ajoutez une photo ou une référence média.</SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-2">
                {(["pickup", "dropoff"] as const).map((type) => (
                  <button
                    className={`h-11 rounded-md border px-3 text-sm font-medium ${
                      proofType === type
                        ? "border-teal-700 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    key={type}
                    type="button"
                    onClick={() => setProofType(type)}
                  >
                    {proofTypeLabels[type]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-2">
                  <Label htmlFor="proof-reference">Référence média</Label>
                  <Input
                    id="proof-reference"
                    className="h-12 text-base"
                    placeholder="preuve://..."
                    value={proofMediaRef}
                    onChange={(event) => setProofMediaRef(event.target.value)}
                  />
                </div>
                <Button
                  className="mt-7 size-12"
                  disabled={Boolean(activeAction)}
                  type="button"
                  variant="secondary"
                  onClick={handleCapturePhoto}
                >
                  {activeAction === "camera" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>

              {proofPhoto ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Photo capturée.
                </div>
              ) : null}
            </div>
            <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button className="h-12 w-full" disabled={Boolean(activeAction)} type="submit">
                {activeAction === "proof" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PackageCheck className="size-4" aria-hidden="true" />
                )}
                Envoyer la preuve
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
                <SheetTitle>Signature client</SheetTitle>
                <SheetDescription>Faites signer le client sur l&apos;écran.</SheetDescription>
              </SheetHeader>

              <div className="space-y-2">
                <Label htmlFor="signed-by">Nom du signataire</Label>
                <Input
                  id="signed-by"
                  className="h-12 text-base"
                  value={signedByName}
                  onChange={(event) => setSignedByName(event.target.value)}
                />
              </div>

              <canvas
                aria-label="Signature client"
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
                Effacer
              </Button>
              <Button className="h-12" disabled={Boolean(activeAction)} type="submit">
                {activeAction === "signature" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserRound className="size-4" aria-hidden="true" />
                )}
                Terminer
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
