"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type { MobileDeliveryTaskStatus, MobileOwnerTodaySummary } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Route,
  Send,
  Shirt,
  TrendingUp,
  Truck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import {
  acceptOwnerAppointment,
  cancelOwnerTask,
  dispatchOwnerTask,
  reassignOwnerTask,
  rejectOwnerAppointment,
} from "../actions";
import { getOwnerDispatchBoard, getOwnerTodaySummary, listOwnerAppointments } from "../queries";
import type {
  OwnerAppointmentListItem,
  OwnerAppointmentStatus,
  OwnerDispatchBoard,
  OwnerDispatchTask,
} from "../types";

type OwnerHomeProps = {
  initialSummary?: MobileOwnerTodaySummary | null;
};

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: true }>;

type MetricItem = {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone: "teal" | "emerald" | "amber" | "sky";
};

type BoardState = {
  appointments: OwnerAppointmentListItem[];
  dispatchBoard: OwnerDispatchBoard | null;
};

type ActionTarget =
  | { kind: "accept-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "reject-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "dispatch-task"; task: OwnerDispatchTask }
  | { kind: "reassign-task"; task: OwnerDispatchTask }
  | { kind: "cancel-task"; task: OwnerDispatchTask };

const numberFormatter = new Intl.NumberFormat("fr-FR");
const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const tenantStatusLabels: Record<MobileOwnerTodaySummary["tenantStatus"], string> = {
  active: "Actif",
  disabled: "Désactivé",
  suspended: "Suspendu",
};

const appointmentStatusLabels: Record<OwnerAppointmentStatus, string> = {
  accepted: "Accepté",
  cancelled: "Annulé",
  done: "Terminé",
  pending: "À valider",
  rejected: "Refusé",
};

const deliveryStatusLabels: Record<MobileDeliveryTaskStatus, string> = {
  arrived: "Arrivé",
  cancelled: "Annulé",
  delivering: "Livraison",
  en_route: "En route",
  exception: "Exception",
  pending_dispatch: "À répartir",
  picked_up: "Collecté",
  signed: "Signé",
};

const taskTypeLabels: Record<OwnerDispatchTask["type"], string> = {
  dropoff: "Dépôt",
  pickup: "Collecte",
};

const toneClasses: Record<MetricItem["tone"], string> = {
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  teal: "bg-teal-50 text-teal-700",
};

const statusBadgeClasses: Record<string, string> = {
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
  delivering: "border-sky-200 bg-sky-50 text-sky-700",
  done: "border-slate-200 bg-slate-100 text-slate-600",
  en_route: "border-sky-200 bg-sky-50 text-sky-700",
  exception: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  pending_dispatch: "border-amber-200 bg-amber-50 text-amber-700",
  picked_up: "border-teal-200 bg-teal-50 text-teal-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatBusinessDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Non planifié";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

function formatLoadTime(value: Date | null): string | null {
  return value ? timeFormatter.format(value) : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Impossible de charger les données owner pour le moment.";
}

function createMetrics(summary: MobileOwnerTodaySummary): MetricItem[] {
  return [
    {
      label: "Commandes",
      value: formatCount(summary.todayOrderCount),
      detail: "Aujourd'hui",
      icon: PackageCheck,
      tone: "teal",
    },
    {
      label: "CA",
      value: formatMoney(summary.todayRevenueAmount),
      detail: "Aujourd'hui",
      icon: TrendingUp,
      tone: "emerald",
    },
    {
      label: "À récupérer",
      value: formatCount(summary.pendingPickupCount),
      detail: "Attente",
      icon: Shirt,
      tone: "amber",
    },
    {
      label: "En cours",
      value: formatCount(summary.inProgressOrderCount),
      detail: "Atelier",
      icon: Clock3,
      tone: "sky",
    },
  ];
}

function getDispatchSummary(board: OwnerDispatchBoard | null) {
  if (board?.summary) {
    return board.summary;
  }

  const tasks = board?.data ?? [];
  return {
    assigned: tasks.filter((task) => task.assigneeUserId).length,
    cancelled: tasks.filter((task) => task.status === "cancelled").length,
    exception: tasks.filter((task) => task.status === "exception").length,
    inProgress: tasks.filter((task) =>
      ["arrived", "delivering", "en_route", "picked_up"].includes(task.status),
    ).length,
    pendingDispatch: tasks.filter((task) => task.status === "pending_dispatch").length,
    signed: tasks.filter((task) => task.status === "signed").length,
  };
}

function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <Badge
      className={`${statusBadgeClasses[status] ?? "border-slate-200 bg-slate-50 text-slate-700"} rounded-md border px-2 py-1`}
      variant="outline"
    >
      {label}
    </Badge>
  );
}

function MetricTile({ metric }: { metric: MetricItem }) {
  const Icon = metric.icon;

  return (
    <div className="min-h-28 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{metric.label}</span>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${toneClasses[metric.tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 break-words text-2xl font-semibold leading-tight tabular-nums text-slate-950">
        {metric.value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {metric.detail}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-base font-semibold tabular-nums text-slate-950">
        {formatCount(value)}
      </span>
    </div>
  );
}

function OperationalCard({
  children,
  icon: Icon,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  icon: IconComponent;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 truncate text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function AppointmentItem({
  appointment,
  onAction,
}: {
  appointment: OwnerAppointmentListItem;
  onAction: (target: ActionTarget) => void;
}) {
  const isPending = appointment.status === "pending";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            {appointment.customerName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {formatDateTime(appointment.scheduledAt ?? appointment.requestedAt)}
          </p>
        </div>
        <StatusBadge
          label={appointmentStatusLabels[appointment.status]}
          status={appointment.status}
        />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">
        {appointment.address || appointment.notes || "Adresse à confirmer"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          disabled={!isPending}
          size="sm"
          type="button"
          onClick={() => onAction({ kind: "accept-appointment", appointment })}
        >
          <UserRoundCheck className="size-4" aria-hidden />
          Accepter
        </Button>
        <Button
          className="w-full"
          disabled={!isPending}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onAction({ kind: "reject-appointment", appointment })}
        >
          <XCircle className="size-4" aria-hidden />
          Refuser
        </Button>
      </div>
    </div>
  );
}

function DispatchTaskItem({
  onAction,
  task,
}: {
  onAction: (target: ActionTarget) => void;
  task: OwnerDispatchTask;
}) {
  const canAssign = task.status === "pending_dispatch";
  const canCancel = task.status !== "cancelled" && task.status !== "signed";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{taskTypeLabels[task.type]}</Badge>
            <StatusBadge label={deliveryStatusLabels[task.status]} status={task.status} />
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-950">
            {task.customerName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {formatDateTime(task.expectedAt)}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">{task.address}</p>
      <p className="mt-2 truncate text-xs text-slate-500">
        Assigné: {task.assigneeName || task.assigneeUserId || "Non assigné"}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          className="w-full px-2"
          disabled={!canAssign}
          size="sm"
          type="button"
          onClick={() => onAction({ kind: "dispatch-task", task })}
        >
          <Send className="size-4" aria-hidden />
          Dispatch
        </Button>
        <Button
          className="w-full px-2"
          disabled={task.status === "cancelled" || task.status === "signed"}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onAction({ kind: "reassign-task", task })}
        >
          <Route className="size-4" aria-hidden />
          Refaire
        </Button>
        <Button
          className="w-full px-2"
          disabled={!canCancel}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onAction({ kind: "cancel-task", task })}
        >
          <XCircle className="size-4" aria-hidden />
          Annuler
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}

function getActionTitle(target: ActionTarget | null): string {
  if (!target) {
    return "Action owner";
  }

  if (target.kind === "accept-appointment") {
    return "Accepter le rendez-vous";
  }
  if (target.kind === "reject-appointment") {
    return "Refuser le rendez-vous";
  }
  if (target.kind === "dispatch-task") {
    return "Dispatcher la tâche";
  }
  if (target.kind === "reassign-task") {
    return "Réassigner la tâche";
  }

  return "Annuler la tâche";
}

function getActionSubject(target: ActionTarget | null): string {
  if (!target) {
    return "Sélectionnez un élément";
  }

  if (
    target.kind === "accept-appointment" ||
    target.kind === "reject-appointment"
  ) {
    return target.appointment.customerName;
  }

  return target.task.customerName;
}

function ActionSheet({
  error,
  isSubmitting,
  note,
  onNoteChange,
  onOpenChange,
  onSubmit,
  open,
  reason,
  assigneeUserId,
  onAssigneeUserIdChange,
  onReasonChange,
  target,
}: {
  error: string | null;
  isSubmitting: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  reason: string;
  assigneeUserId: string;
  onAssigneeUserIdChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  target: ActionTarget | null;
}) {
  const needsAssignee =
    target?.kind === "accept-appointment" ||
    target?.kind === "dispatch-task" ||
    target?.kind === "reassign-task";
  const needsReason =
    target?.kind === "reject-appointment" || target?.kind === "cancel-task";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[88dvh] p-0">
        <div className="flex max-h-[88dvh] flex-col">
          <div className="p-5">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{getActionTitle(target)}</SheetTitle>
              <SheetDescription>{getActionSubject(target)}</SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              {needsAssignee ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    ID livreur
                  </span>
                  <Input
                    className="mt-2"
                    placeholder="user_..."
                    value={assigneeUserId}
                    onChange={(event) => onAssigneeUserIdChange(event.target.value)}
                  />
                </label>
              ) : null}

              {needsReason ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Motif</span>
                  <Textarea
                    className="mt-2 min-h-24"
                    placeholder="Pourquoi cette action est nécessaire ?"
                    value={reason}
                    onChange={(event) => onReasonChange(event.target.value)}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Note</span>
                  <Textarea
                    className="mt-2 min-h-24"
                    placeholder="Consigne optionnelle"
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                  />
                </label>
              )}

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white p-5 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button
              className="w-full"
              disabled={isSubmitting}
              type="button"
              onClick={onSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Confirmer
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function OwnerHome({ initialSummary = null }: OwnerHomeProps) {
  const [summary, setSummary] = useState<MobileOwnerTodaySummary | null>(initialSummary);
  const [boardState, setBoardState] = useState<BoardState>({
    appointments: [],
    dispatchBoard: null,
  });
  const [branchId, setBranchId] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<
    MobileDeliveryTaskStatus | ""
  >("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSummary);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(
    initialSummary ? new Date() : null,
  );
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const metrics = useMemo(() => (summary ? createMetrics(summary) : []), [summary]);
  const dispatchSummary = useMemo(
    () => getDispatchSummary(boardState.dispatchBoard),
    [boardState.dispatchBoard],
  );
  const visibleAppointments = boardState.appointments.slice(0, 5);
  const visibleTasks = boardState.dispatchBoard?.data.slice(0, 8) ?? [];
  const loadTime = formatLoadTime(lastLoadedAt);

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSummary = await getOwnerTodaySummary({ signal });

      if (signal?.aborted) {
        return;
      }

      setSummary(nextSummary);
      setLastLoadedAt(new Date());
    } catch (nextError) {
      if (signal?.aborted) {
        return;
      }

      setError(getErrorMessage(nextError));
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadBoard = useCallback(
    async (signal?: AbortSignal) => {
      const cleanBranchId = branchId.trim();

      if (!cleanBranchId) {
        setBoardState({ appointments: [], dispatchBoard: null });
        return;
      }

      setIsBoardLoading(true);
      setError(null);

      try {
        const [appointments, dispatchBoard] = await Promise.all([
          listOwnerAppointments({ branchId: cleanBranchId }, { signal }),
          getOwnerDispatchBoard(
            {
              branchId: cleanBranchId,
              assigneeUserId: assigneeFilter.trim() || undefined,
              status: deliveryStatusFilter || undefined,
            },
            { signal },
          ),
        ]);

        if (signal?.aborted) {
          return;
        }

        setBoardState({
          appointments: appointments.data,
          dispatchBoard,
        });
        setLastLoadedAt(new Date());
      } catch (nextError) {
        if (signal?.aborted) {
          return;
        }

        setError(getErrorMessage(nextError));
      } finally {
        if (!signal?.aborted) {
          setIsBoardLoading(false);
        }
      }
    },
    [assigneeFilter, branchId, deliveryStatusFilter],
  );

  useEffect(() => {
    if (initialSummary) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadSummary(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [initialSummary, loadSummary]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadBoard(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadBoard]);

  function openAction(target: ActionTarget) {
    setActionError(null);
    setActionTarget(target);
    setNote("");
    setReason("");
    setAssigneeUserId(
      target.kind === "accept-appointment"
        ? target.appointment.assigneeUserId ?? ""
        : "task" in target
          ? target.task.assigneeUserId ?? ""
          : "",
    );
  }

  async function submitAction() {
    if (!actionTarget) {
      return;
    }

    const cleanAssigneeUserId = assigneeUserId.trim();
    const cleanReason = reason.trim();

    if (
      ["accept-appointment", "dispatch-task", "reassign-task"].includes(
        actionTarget.kind,
      ) &&
      !cleanAssigneeUserId
    ) {
      setActionError("Indiquez l'ID du livreur.");
      return;
    }

    if (
      ["reject-appointment", "cancel-task"].includes(actionTarget.kind) &&
      !cleanReason
    ) {
      setActionError("Indiquez le motif.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      if (actionTarget.kind === "accept-appointment") {
        await acceptOwnerAppointment({
          appointmentId: actionTarget.appointment.id,
          assigneeUserId: cleanAssigneeUserId,
          notes: note,
        });
      } else if (actionTarget.kind === "reject-appointment") {
        await rejectOwnerAppointment({
          appointmentId: actionTarget.appointment.id,
          reason: cleanReason,
        });
      } else if (actionTarget.kind === "dispatch-task") {
        await dispatchOwnerTask({
          taskId: actionTarget.task.id,
          assigneeUserId: cleanAssigneeUserId,
          note,
        });
      } else if (actionTarget.kind === "reassign-task") {
        await reassignOwnerTask({
          taskId: actionTarget.task.id,
          assigneeUserId: cleanAssigneeUserId,
          note,
        });
      } else {
        await cancelOwnerTask({
          taskId: actionTarget.task.id,
          reason: cleanReason,
        });
      }

      setActionTarget(null);
      await Promise.all([loadSummary(), loadBoard()]);
    } catch (nextError) {
      setActionError(getErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            <Truck className="size-4" aria-hidden />
            Dispatch owner
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
            Opérations du jour
          </h1>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {summary ? summary.tenantName : "Chargement du pressing"}
          </p>
        </div>
        <Button
          aria-label="Actualiser"
          className="size-11 shrink-0 p-0"
          disabled={isLoading || isBoardLoading}
          type="button"
          variant="secondary"
          onClick={() => {
            void Promise.all([loadSummary(), loadBoard()]);
          }}
        >
          {isLoading || isBoardLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCcw className="size-4" aria-hidden />
          )}
        </Button>
      </header>

      {summary ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="min-w-0 truncate text-slate-600">
            {formatBusinessDate(summary.businessDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {tenantStatusLabels[summary.tenantStatus]}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading && !summary ? (
        <div className="mt-8 flex items-center justify-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-700" aria-hidden />
          Chargement des indicateurs
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="mt-5">
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <MetricTile key={metric.label} metric={metric} />
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Branche
                </span>
                <Input
                  className="mt-2"
                  placeholder="branch_..."
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Livreur
                  </span>
                  <Input
                    className="mt-2"
                    placeholder="Tous"
                    value={assigneeFilter}
                    onChange={(event) => setAssigneeFilter(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Statut
                  </span>
                  <select
                    className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={deliveryStatusFilter}
                    onChange={(event) =>
                      setDeliveryStatusFilter(
                        event.target.value as MobileDeliveryTaskStatus | "",
                      )
                    }
                  >
                    <option value="">Tous</option>
                    {Object.entries(deliveryStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <OperationalCard
            icon={CalendarDays}
            subtitle={`${formatCount(boardState.appointments.length)} rendez-vous`}
            title="Rendez-vous"
          >
            <div className="mt-4">
              <SummaryRow label="En attente" value={summary.appointmentSummary.pending} />
              <SummaryRow label="Acceptés" value={summary.appointmentSummary.accepted} />
              <SummaryRow label="Terminés" value={summary.appointmentSummary.done} />
              <SummaryRow label="Annulés" value={summary.appointmentSummary.cancelled} />
            </div>
            <div className="mt-4 space-y-3">
              {!branchId.trim() ? (
                <EmptyState message="Renseignez une branche pour charger les rendez-vous." />
              ) : isBoardLoading && !visibleAppointments.length ? (
                <EmptyState message="Chargement des rendez-vous..." />
              ) : visibleAppointments.length ? (
                visibleAppointments.map((appointment) => (
                  <AppointmentItem
                    key={appointment.id}
                    appointment={appointment}
                    onAction={openAction}
                  />
                ))
              ) : (
                <EmptyState message="Aucun rendez-vous à traiter." />
              )}
            </div>
          </OperationalCard>

          <OperationalCard
            icon={Truck}
            subtitle={
              summary.featureFlags.deliveryEnabled
                ? "Service livraison actif"
                : "Service livraison inactif"
            }
            title="Dispatch livraison"
          >
            <div className="mt-4">
              <SummaryRow label="À répartir" value={dispatchSummary.pendingDispatch} />
              <SummaryRow label="Assignées" value={dispatchSummary.assigned} />
              <SummaryRow label="En tournée" value={dispatchSummary.inProgress} />
              <SummaryRow label="Exceptions" value={dispatchSummary.exception} />
            </div>
            <div className="mt-4 space-y-3">
              {!branchId.trim() ? (
                <EmptyState message="Renseignez une branche pour charger le dispatch." />
              ) : isBoardLoading && !visibleTasks.length ? (
                <EmptyState message="Chargement du dispatch..." />
              ) : visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <DispatchTaskItem key={task.id} task={task} onAction={openAction} />
                ))
              ) : (
                <EmptyState message="Aucune tâche de livraison dans ce filtre." />
              )}
            </div>
          </OperationalCard>

          {loadTime ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              Mis à jour à {loadTime}
            </p>
          ) : null}
        </>
      ) : null}

      <ActionSheet
        assigneeUserId={assigneeUserId}
        error={actionError}
        isSubmitting={isSubmitting}
        note={note}
        open={Boolean(actionTarget)}
        reason={reason}
        target={actionTarget}
        onAssigneeUserIdChange={setAssigneeUserId}
        onNoteChange={setNote}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setActionTarget(null);
          }
        }}
        onReasonChange={setReason}
        onSubmit={() => {
          void submitAction();
        }}
      />
    </main>
  );
}
