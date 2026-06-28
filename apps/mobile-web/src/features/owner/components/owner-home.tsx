"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type {
  MobileDeliveryTaskStatus,
  MobileOwnerTodaySummary,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { SupportedLocale, TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
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
  RotateCcw,
  Send,
  Shirt,
  TrendingUp,
  Truck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import {
  acceptOwnerAppointment,
  approveOwnerRefundRequest,
  cancelOwnerTask,
  dispatchOwnerTask,
  reassignOwnerTask,
  rejectOwnerAppointment,
  rejectOwnerRefundRequest,
} from "../actions";
import {
  getOwnerDispatchBoard,
  getOwnerTodaySummary,
  listOwnerAppointments,
  listOwnerRefundRequests,
} from "../queries";
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
  refundRequests: MobileRefundRequest[];
};

type ActionTarget =
  | { kind: "accept-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "reject-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "dispatch-task"; task: OwnerDispatchTask }
  | { kind: "reassign-task"; task: OwnerDispatchTask }
  | { kind: "cancel-task"; task: OwnerDispatchTask }
  | { kind: "approve-refund"; refundRequest: MobileRefundRequest }
  | { kind: "reject-refund"; refundRequest: MobileRefundRequest };

const numberFormatter = new Intl.NumberFormat("fr-FR");
const intlLocales: Record<SupportedLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
  "zh-CN": "zh-CN",
};

const tenantStatusLabelKeys: Record<MobileOwnerTodaySummary["tenantStatus"], TranslationKey> = {
  active: "owner.tenantStatus.active",
  disabled: "owner.tenantStatus.disabled",
  suspended: "owner.tenantStatus.suspended",
};

const appointmentStatusLabelKeys: Record<OwnerAppointmentStatus, TranslationKey> = {
  accepted: "owner.appointmentStatus.accepted",
  cancelled: "owner.appointmentStatus.cancelled",
  done: "owner.appointmentStatus.done",
  pending: "owner.appointmentStatus.pending",
  rejected: "owner.appointmentStatus.rejected",
};

const deliveryStatusLabelKeys: Record<MobileDeliveryTaskStatus, TranslationKey> = {
  arrived: "owner.deliveryStatus.arrived",
  cancelled: "owner.deliveryStatus.cancelled",
  delivering: "owner.deliveryStatus.delivering",
  en_route: "owner.deliveryStatus.en_route",
  exception: "owner.deliveryStatus.exception",
  pending_dispatch: "owner.deliveryStatus.pending_dispatch",
  picked_up: "owner.deliveryStatus.picked_up",
  signed: "owner.deliveryStatus.signed",
};

const taskTypeLabelKeys: Record<OwnerDispatchTask["type"], TranslationKey> = {
  dropoff: "owner.taskType.dropoff",
  pickup: "owner.taskType.pickup",
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

function formatCount(value: number, locale?: string): string {
  return locale ? new Intl.NumberFormat(locale).format(value) : numberFormatter.format(value);
}

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBusinessDate(value: string, locale: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatDateTime(value: string | null, locale: string, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function formatLoadTime(value: Date | null, locale: string): string | null {
  return value
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

function createMetrics(
  summary: MobileOwnerTodaySummary,
  t: ReturnType<typeof useTranslation>["t"],
  locale: string,
): MetricItem[] {
  return [
    {
      label: t("owner.metrics.orders"),
      value: formatCount(summary.todayOrderCount, locale),
      detail: t("owner.today"),
      icon: PackageCheck,
      tone: "teal",
    },
    {
      label: t("owner.metrics.revenue"),
      value: formatMoney(summary.todayRevenueAmount, locale),
      detail: t("owner.today"),
      icon: TrendingUp,
      tone: "emerald",
    },
    {
      label: t("owner.metrics.pickup"),
      value: formatCount(summary.pendingPickupCount, locale),
      detail: t("owner.waiting"),
      icon: Shirt,
      tone: "amber",
    },
    {
      label: t("owner.metrics.progress"),
      value: formatCount(summary.inProgressOrderCount, locale),
      detail: t("owner.workshop"),
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
  const { locale } = useTranslation();

  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-base font-semibold tabular-nums text-slate-950">
        {formatCount(value, intlLocales[locale])}
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
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];
  const notScheduled = t("owner.notScheduled");
  const isPending = appointment.status === "pending";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            {appointment.customerName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {formatDateTime(appointment.scheduledAt ?? appointment.requestedAt, intlLocale, notScheduled)}
          </p>
        </div>
        <StatusBadge
          label={t(appointmentStatusLabelKeys[appointment.status])}
          status={appointment.status}
        />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">
        {appointment.address || appointment.notes || t("owner.addressToConfirm")}
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
          {t("owner.actions.accept")}
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
          {t("owner.actions.reject")}
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
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];
  const canAssign = task.status === "pending_dispatch";
  const canCancel = task.status !== "cancelled" && task.status !== "signed";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(taskTypeLabelKeys[task.type])}</Badge>
            <StatusBadge label={t(deliveryStatusLabelKeys[task.status])} status={task.status} />
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-950">
            {task.customerName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {formatDateTime(task.expectedAt, intlLocale, t("owner.notScheduled"))}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">{task.address}</p>
      <p className="mt-2 truncate text-xs text-slate-500">
        {t("owner.assigned")}: {task.assigneeName || task.assigneeUserId || t("owner.unassigned")}
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
          {t("owner.actions.dispatch")}
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
          {t("owner.actions.reassign")}
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
          {t("owner.actions.cancel")}
        </Button>
      </div>
    </div>
  );
}

function RefundRequestItem({
  onAction,
  refundRequest,
}: {
  onAction: (target: ActionTarget) => void;
  refundRequest: MobileRefundRequest;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            {t("customer.detail.orderPrefix", { id: refundRequest.orderId.slice(-6).toUpperCase() })}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {formatDateTime(refundRequest.createdAt, intlLocale, t("owner.notScheduled"))}
          </p>
        </div>
        <StatusBadge label={t("owner.actions.approveRefund")} status={refundRequest.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-700">{refundRequest.reason}</p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
          {refundRequest.amount}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          size="sm"
          type="button"
          onClick={() => onAction({ kind: "approve-refund", refundRequest })}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {t("owner.actions.approveRefund")}
        </Button>
        <Button
          className="w-full"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onAction({ kind: "reject-refund", refundRequest })}
        >
          <XCircle className="size-4" aria-hidden />
          {t("owner.actions.rejectRefund")}
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

function getActionTitleKey(target: ActionTarget | null): TranslationKey {
  if (!target) {
    return "owner.actions.actionOwner";
  }

  if (target.kind === "accept-appointment") {
    return "owner.actions.acceptAppointment";
  }
  if (target.kind === "reject-appointment") {
    return "owner.actions.rejectAppointment";
  }
  if (target.kind === "dispatch-task") {
    return "owner.actions.dispatchTask";
  }
  if (target.kind === "reassign-task") {
    return "owner.actions.reassignTask";
  }
  if (target.kind === "approve-refund") {
    return "owner.actions.approveRefundTitle";
  }
  if (target.kind === "reject-refund") {
    return "owner.actions.rejectRefundTitle";
  }

  return "owner.actions.cancelTask";
}

function getActionSubject(target: ActionTarget | null, fallback: string): string {
  if (!target) {
    return fallback;
  }

  if (
    target.kind === "accept-appointment" ||
    target.kind === "reject-appointment"
  ) {
    return target.appointment.customerName;
  }

  if (
    target.kind === "approve-refund" ||
    target.kind === "reject-refund"
  ) {
    return `${target.refundRequest.amount} - ${target.refundRequest.reason}`;
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
  const { t } = useTranslation();
  const needsAssignee =
    target?.kind === "accept-appointment" ||
    target?.kind === "dispatch-task" ||
    target?.kind === "reassign-task";
  const needsReason =
    target?.kind === "reject-appointment" ||
    target?.kind === "cancel-task" ||
    target?.kind === "reject-refund";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[88dvh] p-0">
        <div className="flex max-h-[88dvh] flex-col">
          <div className="p-5">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{t(getActionTitleKey(target))}</SheetTitle>
              <SheetDescription>{getActionSubject(target, t("owner.actions.selectItem"))}</SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              {needsAssignee ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("owner.forms.assigneeId")}
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
                  <span className="text-sm font-medium text-slate-700">
                    {t("owner.forms.reason")}
                  </span>
                  <Textarea
                    className="mt-2 min-h-24"
                    placeholder={t("owner.forms.reasonPlaceholder")}
                    value={reason}
                    onChange={(event) => onReasonChange(event.target.value)}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("owner.forms.note")}
                  </span>
                  <Textarea
                    className="mt-2 min-h-24"
                    placeholder={t("owner.forms.notePlaceholder")}
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
              {t("owner.actions.confirm")}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function OwnerHome({ initialSummary = null }: OwnerHomeProps) {
  const { locale, t } = useTranslation();
  const intlLocale = intlLocales[locale];
  const [summary, setSummary] = useState<MobileOwnerTodaySummary | null>(initialSummary);
  const [boardState, setBoardState] = useState<BoardState>({
    appointments: [],
    dispatchBoard: null,
    refundRequests: [],
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

  const metrics = useMemo(
    () => (summary ? createMetrics(summary, t, intlLocale) : []),
    [intlLocale, summary, t],
  );
  const dispatchSummary = useMemo(
    () => getDispatchSummary(boardState.dispatchBoard),
    [boardState.dispatchBoard],
  );
  const visibleAppointments = boardState.appointments.slice(0, 5);
  const visibleTasks = boardState.dispatchBoard?.data.slice(0, 8) ?? [];
  const visibleRefundRequests = boardState.refundRequests.slice(0, 5);
  const loadTime = formatLoadTime(lastLoadedAt, intlLocale);

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

      setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [t]);

  const loadBoard = useCallback(
    async (signal?: AbortSignal) => {
      const cleanBranchId = branchId.trim();

      if (!cleanBranchId) {
        setIsBoardLoading(true);
        setError(null);

        try {
          const refundRequests = await listOwnerRefundRequests({ signal });

          if (!signal?.aborted) {
            setBoardState({
              appointments: [],
              dispatchBoard: null,
              refundRequests: refundRequests.data,
            });
            setLastLoadedAt(new Date());
          }
        } catch (nextError) {
          if (!signal?.aborted) {
            setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
          }
        } finally {
          if (!signal?.aborted) {
            setIsBoardLoading(false);
          }
        }
        return;
      }

      setIsBoardLoading(true);
      setError(null);

      try {
        const [appointments, dispatchBoard, refundRequests] = await Promise.all([
          listOwnerAppointments({ branchId: cleanBranchId }, { signal }),
          getOwnerDispatchBoard(
            {
              branchId: cleanBranchId,
              assigneeUserId: assigneeFilter.trim() || undefined,
              status: deliveryStatusFilter || undefined,
            },
            { signal },
          ),
          listOwnerRefundRequests({ signal }),
        ]);

        if (signal?.aborted) {
          return;
        }

        setBoardState({
          appointments: appointments.data,
          dispatchBoard,
          refundRequests: refundRequests.data,
        });
        setLastLoadedAt(new Date());
      } catch (nextError) {
        if (signal?.aborted) {
          return;
        }

        setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
      } finally {
        if (!signal?.aborted) {
          setIsBoardLoading(false);
        }
      }
    },
    [assigneeFilter, branchId, deliveryStatusFilter, t],
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
      setActionError(t("owner.messages.assigneeRequired"));
      return;
    }

    if (
      ["reject-appointment", "cancel-task", "reject-refund"].includes(
        actionTarget.kind,
      ) &&
      !cleanReason
    ) {
      setActionError(t("owner.messages.reasonRequired"));
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
      } else if (actionTarget.kind === "cancel-task") {
        await cancelOwnerTask({
          taskId: actionTarget.task.id,
          reason: cleanReason,
        });
      } else if (actionTarget.kind === "approve-refund") {
        await approveOwnerRefundRequest(actionTarget.refundRequest.id);
      } else {
        await rejectOwnerRefundRequest({
          refundRequestId: actionTarget.refundRequest.id,
          reason: cleanReason,
        });
      }

      setActionTarget(null);
      await Promise.all([loadSummary(), loadBoard()]);
    } catch (nextError) {
      setActionError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
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
            {t("owner.dispatchOwner")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">
            {t("owner.operationsToday")}
          </h1>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {summary ? summary.tenantName : t("owner.loadingTenant")}
          </p>
        </div>
        <Button
          aria-label={t("common.refresh")}
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
            {formatBusinessDate(summary.businessDate, intlLocale)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {t(tenantStatusLabelKeys[summary.tenantStatus])}
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
          {t("owner.loadingMetrics")}
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
                  {t("owner.branch")}
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
                    {t("owner.driver")}
                  </span>
                  <Input
                    className="mt-2"
                    placeholder={t("owner.all")}
                    value={assigneeFilter}
                    onChange={(event) => setAssigneeFilter(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("common.status")}
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
                    <option value="">{t("owner.all")}</option>
                    {Object.entries(deliveryStatusLabelKeys).map(([value, labelKey]) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <OperationalCard
            icon={CalendarDays}
            subtitle={t("owner.appointmentCount", {
              count: formatCount(boardState.appointments.length, intlLocale),
            })}
            title={t("owner.sections.appointments")}
          >
            <div className="mt-4">
              <SummaryRow label={t("owner.appointmentStatus.pending")} value={summary.appointmentSummary.pending} />
              <SummaryRow label={t("owner.appointmentStatus.accepted")} value={summary.appointmentSummary.accepted} />
              <SummaryRow label={t("owner.appointmentStatus.done")} value={summary.appointmentSummary.done} />
              <SummaryRow label={t("owner.appointmentStatus.cancelled")} value={summary.appointmentSummary.cancelled} />
            </div>
            <div className="mt-4 space-y-3">
              {!branchId.trim() ? (
                <EmptyState message={t("owner.messages.branchRequiredAppointments")} />
              ) : isBoardLoading && !visibleAppointments.length ? (
                <EmptyState message={t("owner.messages.loadingAppointments")} />
              ) : visibleAppointments.length ? (
                visibleAppointments.map((appointment) => (
                  <AppointmentItem
                    key={appointment.id}
                    appointment={appointment}
                    onAction={openAction}
                  />
                ))
              ) : (
                <EmptyState message={t("owner.messages.noAppointments")} />
              )}
            </div>
          </OperationalCard>

          <OperationalCard
            icon={Truck}
            subtitle={
              summary.featureFlags.deliveryEnabled
                ? t("owner.deliveryActive")
                : t("owner.deliveryInactive")
            }
            title={t("owner.sections.dispatch")}
          >
            <div className="mt-4">
              <SummaryRow label={t("owner.deliveryStatus.pending_dispatch")} value={dispatchSummary.pendingDispatch} />
              <SummaryRow label={t("owner.assigned")} value={dispatchSummary.assigned} />
              <SummaryRow label={t("owner.metrics.progress")} value={dispatchSummary.inProgress} />
              <SummaryRow label={t("owner.deliveryStatus.exception")} value={dispatchSummary.exception} />
            </div>
            <div className="mt-4 space-y-3">
              {!branchId.trim() ? (
                <EmptyState message={t("owner.messages.branchRequiredDispatch")} />
              ) : isBoardLoading && !visibleTasks.length ? (
                <EmptyState message={t("owner.messages.loadingDispatch")} />
              ) : visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <DispatchTaskItem key={task.id} task={task} onAction={openAction} />
                ))
              ) : (
                <EmptyState message={t("owner.messages.noDeliveryTasks")} />
              )}
            </div>
          </OperationalCard>

          <OperationalCard
            icon={RotateCcw}
            subtitle={t("owner.requestCount", {
              count: formatCount(boardState.refundRequests.length, intlLocale),
            })}
            title={t("owner.sections.refunds")}
          >
            <div className="mt-4 space-y-3">
              {isBoardLoading && !visibleRefundRequests.length ? (
                <EmptyState message={t("owner.messages.loadingRefunds")} />
              ) : visibleRefundRequests.length ? (
                visibleRefundRequests.map((refundRequest) => (
                  <RefundRequestItem
                    key={refundRequest.id}
                    refundRequest={refundRequest}
                    onAction={openAction}
                  />
                ))
              ) : (
                <EmptyState message={t("owner.messages.noRefunds")} />
              )}
            </div>
          </OperationalCard>

          {loadTime ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              {t("owner.updatedAt", { time: loadTime })}
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
