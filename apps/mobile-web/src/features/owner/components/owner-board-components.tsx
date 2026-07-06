"use client";

import type { ComponentType, ReactNode } from "react";
import type {
  MobileDeliveryTaskStatus,
  MobileOwnerBranchOption,
  MobileOwnerDriverOption,
  MobileOwnerTodaySummary,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { SupportedLocale, TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  PackageCheck,
  Route,
  Send,
  Shirt,
  TrendingUp,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import { formatTenantMoney } from "@/lib/currency";

import type {
  OwnerAppointmentListItem,
  OwnerAppointmentStatus,
  OwnerDispatchTask,
} from "../types";

export type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: true }>;

export type MetricItem = {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone: "blue" | "emerald" | "amber" | "sky";
};

export type ActionTarget =
  | { kind: "accept-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "reject-appointment"; appointment: OwnerAppointmentListItem }
  | { kind: "dispatch-task"; task: OwnerDispatchTask }
  | { kind: "reassign-task"; task: OwnerDispatchTask }
  | { kind: "cancel-task"; task: OwnerDispatchTask }
  | { kind: "approve-refund"; refundRequest: MobileRefundRequest }
  | { kind: "reject-refund"; refundRequest: MobileRefundRequest };

const numberFormatter = new Intl.NumberFormat("fr-FR");

export const ownerIntlLocales: Record<SupportedLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
  "zh-CN": "zh-CN",
};

const appointmentStatusLabelKeys: Record<OwnerAppointmentStatus, TranslationKey> = {
  accepted: "owner.appointmentStatus.accepted",
  cancelled: "owner.appointmentStatus.cancelled",
  done: "owner.appointmentStatus.done",
  pending: "owner.appointmentStatus.pending",
  rejected: "owner.appointmentStatus.rejected",
};

export const deliveryStatusLabelKeys: Record<MobileDeliveryTaskStatus, TranslationKey> = {
  arrived: "owner.deliveryStatus.arrived",
  cancelled: "owner.deliveryStatus.cancelled",
  delivering: "owner.deliveryStatus.delivering",
  en_route: "owner.deliveryStatus.en_route",
  exception: "owner.deliveryStatus.exception",
  pending_dispatch: "owner.deliveryStatus.pending_dispatch",
  picked_up: "owner.deliveryStatus.picked_up",
  signed: "owner.deliveryStatus.signed",
};

const refundStatusLabelKeys: Record<MobileRefundRequest["status"], TranslationKey> = {
  approved: "owner.refundStatus.approved",
  failed: "owner.refundStatus.failed",
  pending: "owner.refundStatus.pending",
  processing: "owner.refundStatus.processing",
  refunded: "owner.refundStatus.refunded",
  rejected: "owner.refundStatus.rejected",
};

const taskTypeLabelKeys: Record<OwnerDispatchTask["type"], TranslationKey> = {
  dropoff: "owner.taskType.dropoff",
  pickup: "owner.taskType.pickup",
};

const toneClasses: Record<MetricItem["tone"], string> = {
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  blue: "bg-blue-50 text-blue-700",
};

const statusBadgeClasses: Record<string, string> = {
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
  delivering: "border-sky-200 bg-sky-50 text-sky-700",
  done: "border-slate-200 bg-slate-100 text-slate-600",
  en_route: "border-sky-200 bg-sky-50 text-sky-700",
  exception: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  pending_dispatch: "border-amber-200 bg-amber-50 text-amber-700",
  picked_up: "border-blue-200 bg-blue-50 text-blue-700",
  processing: "border-sky-200 bg-sky-50 text-sky-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function formatCount(value: number, locale?: string): string {
  return locale ? new Intl.NumberFormat(locale).format(value) : numberFormatter.format(value);
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

export function formatBranchOption(branch: MobileOwnerBranchOption): string {
  return branch.address ? `${branch.name} - ${branch.address}` : branch.name;
}

export function formatDriverOption(driver: MobileOwnerDriverOption): string {
  const contact = driver.phone ?? driver.email;

  return contact ? `${driver.displayName} - ${contact}` : driver.displayName;
}

export function createMetrics(
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
      tone: "blue",
    },
    {
      label: t("owner.metrics.revenue"),
      value: formatTenantMoney(summary.todayRevenueAmount, locale, summary.currency),
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

export function MetricTile({ metric }: { metric: MetricItem }) {
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

export function SummaryRow({ label, value }: { label: string; value: number }) {
  const { locale } = useTranslation();

  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-base font-semibold tabular-nums text-slate-950">
        {formatCount(value, ownerIntlLocales[locale])}
      </span>
    </div>
  );
}

export function OperationalCard({
  children,
  icon: Icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: IconComponent;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
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

export function ShowMoreFooter({
  shown,
  total,
  onShowMore,
}: {
  shown: number;
  total: number;
  onShowMore: () => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
  const clampedShown = Math.min(shown, total);

  return (
    <div className="mt-4 flex min-h-10 items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-medium text-slate-500">
        {t("owner.shownCount", {
          shown: formatCount(clampedShown, intlLocale),
          total: formatCount(total, intlLocale),
        })}
      </p>
      {clampedShown < total ? (
        <Button
          className="h-9 shrink-0 px-3"
          size="sm"
          type="button"
          variant="secondary"
          onClick={onShowMore}
        >
          <ChevronDown className="size-4" aria-hidden />
          {t("owner.showMore")}
        </Button>
      ) : null}
    </div>
  );
}

export function AppointmentItem({
  appointment,
  onAction,
}: {
  appointment: OwnerAppointmentListItem;
  onAction: (target: ActionTarget) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
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

export function DispatchTaskItem({
  onAction,
  task,
}: {
  onAction: (target: ActionTarget) => void;
  task: OwnerDispatchTask;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
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

export function RefundRequestItem({
  currency,
  onAction,
  refundRequest,
}: {
  currency: string;
  onAction: (target: ActionTarget) => void;
  refundRequest: MobileRefundRequest;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];

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
        <StatusBadge label={t(refundStatusLabelKeys[refundRequest.status])} status={refundRequest.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-700">{refundRequest.reason}</p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
          {formatTenantMoney(refundRequest.amount, intlLocale, currency)}
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

export function EmptyState({ message }: { message: string }) {
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

function getActionSubject(
  target: ActionTarget | null,
  fallback: string,
  locale: string,
  currency: string,
): string {
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
    return `${formatTenantMoney(
      target.refundRequest.amount,
      locale,
      currency,
    )} - ${target.refundRequest.reason}`;
  }

  return target.task.customerName;
}

export function ActionSheet({
  currency,
  drivers,
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
  currency: string;
  drivers: MobileOwnerDriverOption[];
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
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
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
              <SheetDescription>
                {getActionSubject(
                  target,
                  t("owner.actions.selectItem"),
                  intlLocale,
                  currency,
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              {needsAssignee ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("owner.forms.assignee")}
                  </span>
                  <select
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={assigneeUserId}
                    onChange={(event) => onAssigneeUserIdChange(event.target.value)}
                  >
                    <option value="">{t("owner.actions.selectDriver")}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {formatDriverOption(driver)}
                      </option>
                    ))}
                  </select>
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
