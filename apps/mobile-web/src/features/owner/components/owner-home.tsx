"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MobileDeliveryTaskStatus,
  MobileOwnerBranchOption,
  MobileOwnerDriverOption,
  MobileOwnerTodaySummary,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Button, toast } from "@cleanhub/ui";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  LogOut,
  RefreshCcw,
  RotateCcw,
  Truck,
  UserRound,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobilePageSkeleton } from "@/components/mobile-skeleton";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SectionCard } from "@/components/section-card";
import { WorkspaceHeader } from "@/components/workspace-header";
import { resolveTenantCurrency } from "@/lib/currency";

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
  listOwnerBranches,
  listOwnerAppointments,
  listOwnerDrivers,
  listOwnerRefundRequests,
} from "../queries";
import type {
  OwnerAppointmentListItem,
  OwnerDispatchBoard,
} from "../types";
import {
  ActionSheet,
  AppointmentItem,
  DispatchTaskItem,
  EmptyState,
  MetricTile,
  OperationalCard,
  RefundRequestItem,
  ShowMoreFooter,
  SummaryRow,
  createMetrics,
  deliveryStatusLabelKeys,
  formatBranchOption,
  formatCount,
  formatDriverOption,
  ownerIntlLocales,
  type ActionTarget,
} from "./owner-board-components";

type OwnerHomeProps = {
  currency?: string;
  initialSummary?: MobileOwnerTodaySummary | null;
  isLoggingOut?: boolean;
  onLogout?: () => void;
};

type BoardState = {
  appointments: OwnerAppointmentListItem[];
  dispatchBoard: OwnerDispatchBoard | null;
  refundRequests: MobileRefundRequest[];
};

type BoardVisibleLimits = {
  appointments: number;
  tasks: number;
  refundRequests: number;
};

type OwnerTab = "overview" | "dispatch" | "refunds" | "profile";

const OWNER_BOARD_SHOW_MORE_INCREMENT = 10;
const INITIAL_OWNER_BOARD_VISIBLE_LIMITS: BoardVisibleLimits = {
  appointments: 5,
  tasks: 8,
  refundRequests: 5,
};

const tenantStatusLabelKeys: Record<MobileOwnerTodaySummary["tenantStatus"], TranslationKey> = {
  active: "owner.tenantStatus.active",
  disabled: "owner.tenantStatus.disabled",
  suspended: "owner.tenantStatus.suspended",
};

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

export function OwnerHome({
  currency,
  initialSummary = null,
  isLoggingOut = false,
  onLogout = () => undefined,
}: OwnerHomeProps) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
  const [summary, setSummary] = useState<MobileOwnerTodaySummary | null>(initialSummary);
  const [activeTab, setActiveTab] = useState<OwnerTab>("overview");
  const [branches, setBranches] = useState<MobileOwnerBranchOption[]>([]);
  const [drivers, setDrivers] = useState<MobileOwnerDriverOption[]>([]);
  const [boardState, setBoardState] = useState<BoardState>({
    appointments: [],
    dispatchBoard: null,
    refundRequests: [],
  });
  const [visibleLimits, setVisibleLimits] = useState<BoardVisibleLimits>(
    INITIAL_OWNER_BOARD_VISIBLE_LIMITS,
  );
  const [branchId, setBranchId] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<
    MobileDeliveryTaskStatus | ""
  >("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSummary);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
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
  const totalAppointments = boardState.appointments.length;
  const totalTasks = boardState.dispatchBoard?.data.length ?? 0;
  const totalRefundRequests = boardState.refundRequests.length;
  const visibleAppointments = boardState.appointments.slice(
    0,
    visibleLimits.appointments,
  );
  const visibleTasks = boardState.dispatchBoard?.data.slice(0, visibleLimits.tasks) ?? [];
  const visibleRefundRequests = boardState.refundRequests.slice(
    0,
    visibleLimits.refundRequests,
  );
  const shouldShowAppointmentFooter =
    totalAppointments > INITIAL_OWNER_BOARD_VISIBLE_LIMITS.appointments;
  const shouldShowTaskFooter = totalTasks > INITIAL_OWNER_BOARD_VISIBLE_LIMITS.tasks;
  const shouldShowRefundFooter =
    totalRefundRequests > INITIAL_OWNER_BOARD_VISIBLE_LIMITS.refundRequests;
  const loadTime = formatLoadTime(lastLoadedAt, intlLocale);
  const tenantCurrency = resolveTenantCurrency(summary?.currency ?? currency);

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
      setIsLoading(false);
    }
  }, [t]);

  const loadBranches = useCallback(async (signal?: AbortSignal) => {
    setIsDirectoryLoading(true);

    try {
      const response = await listOwnerBranches({ signal });

      if (signal?.aborted) {
        return;
      }

      setBranches(response.data);
      setBranchId((current) => current || (response.data[0]?.id ?? ""));
    } catch (nextError) {
      if (!signal?.aborted) {
        setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
      }
    } finally {
      setIsDirectoryLoading(false);
    }
  }, [t]);

  const loadDrivers = useCallback(
    async (signal?: AbortSignal) => {
      const cleanBranchId = branchId.trim();

      if (!cleanBranchId) {
        setDrivers([]);
        setAssigneeFilter("");
        setAssigneeUserId("");
        return;
      }

      setIsDirectoryLoading(true);

      try {
        const response = await listOwnerDrivers(
          { branchId: cleanBranchId },
          { signal },
        );

        if (signal?.aborted) {
          return;
        }

        setDrivers(response.data);
        setAssigneeFilter((current) =>
          current && response.data.some((driver) => driver.id === current)
            ? current
            : "",
        );
        setAssigneeUserId((current) =>
          current && response.data.some((driver) => driver.id === current)
            ? current
            : "",
        );
      } catch (nextError) {
        if (!signal?.aborted) {
          setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
        }
      } finally {
        setIsDirectoryLoading(false);
      }
    },
    [branchId, t],
  );

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
            setVisibleLimits(INITIAL_OWNER_BOARD_VISIBLE_LIMITS);
            setLastLoadedAt(new Date());
          }
        } catch (nextError) {
          if (!signal?.aborted) {
            setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
          }
        } finally {
          setIsBoardLoading(false);
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
        setVisibleLimits(INITIAL_OWNER_BOARD_VISIBLE_LIMITS);
        setLastLoadedAt(new Date());
      } catch (nextError) {
        if (signal?.aborted) {
          return;
        }

        setError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
      } finally {
        setIsBoardLoading(false);
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
      void loadBranches(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadBranches]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadDrivers(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadDrivers]);

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
      toast.success(t("owner.messages.actionDone"));
    } catch (nextError) {
      setActionError(getErrorMessage(nextError, t("owner.messages.loadFailed")));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !summary) {
    return <MobilePageSkeleton label={t("owner.loadingMetrics")} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <WorkspaceHeader
        eyebrow={t("owner.dispatchOwner")}
        isLoggingOut={isLoggingOut}
        logoutLabel={t("auth.logout")}
        showMenu={false}
        subtitle={summary ? summary.tenantName : t("owner.loadingTenant")}
        title={t("owner.operationsToday")}
        onLogout={onLogout}
      />

      {summary ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
          <span className="min-w-0 truncate text-slate-600">
            {formatBusinessDate(summary.businessDate, intlLocale)}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {t(tenantStatusLabelKeys[summary.tenantStatus])}
            </span>
            <Button
              aria-label={t("common.refresh")}
              className="size-9 p-0"
              disabled={isLoading || isBoardLoading}
              size="icon"
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
          </div>
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

      {summary ? (
        <>
          {activeTab === "overview" ? (
          <section className="mt-5">
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <MetricTile key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
          ) : null}

          {activeTab === "dispatch" ? (
          <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  {t("owner.branch")}
                </span>
                <select
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  disabled={isDirectoryLoading && !branches.length}
                  value={branchId}
                  onChange={(event) => {
                    setBranchId(event.target.value);
                    setAssigneeFilter("");
                    setAssigneeUserId("");
                  }}
                >
                  <option value="">
                    {isDirectoryLoading && !branches.length
                      ? t("common.loading")
                      : t("owner.actions.selectBranch")}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {formatBranchOption(branch)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("owner.driver")}
                  </span>
                  <select
                    className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    disabled={!branchId.trim() || (isDirectoryLoading && !drivers.length)}
                    value={assigneeFilter}
                    onChange={(event) => setAssigneeFilter(event.target.value)}
                  >
                    <option value="">{t("owner.all")}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {formatDriverOption(driver)}
                      </option>
                    ))}
                  </select>
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
          ) : null}

          {activeTab === "overview" ? (
            <section className="mt-5 grid gap-4">
              <SectionCard
                icon={CalendarDays}
                subtitle={t("owner.appointmentCount", {
                  count: formatCount(boardState.appointments.length, intlLocale),
                })}
                title={t("owner.sections.appointments")}
              >
                <SummaryRow label={t("owner.appointmentStatus.pending")} value={summary.appointmentSummary.pending} />
                <SummaryRow label={t("owner.appointmentStatus.accepted")} value={summary.appointmentSummary.accepted} />
                <SummaryRow label={t("owner.appointmentStatus.done")} value={summary.appointmentSummary.done} />
                <SummaryRow label={t("owner.appointmentStatus.cancelled")} value={summary.appointmentSummary.cancelled} />
              </SectionCard>
              <SectionCard
                icon={Truck}
                subtitle={
                  summary.featureFlags.deliveryEnabled
                    ? t("owner.deliveryActive")
                    : t("owner.deliveryInactive")
                }
                title={t("owner.sections.dispatch")}
              >
                <SummaryRow label={t("owner.deliveryStatus.pending_dispatch")} value={dispatchSummary.pendingDispatch} />
                <SummaryRow label={t("owner.assigned")} value={dispatchSummary.assigned} />
                <SummaryRow label={t("owner.metrics.progress")} value={dispatchSummary.inProgress} />
                <SummaryRow label={t("owner.deliveryStatus.exception")} value={dispatchSummary.exception} />
              </SectionCard>
            </section>
          ) : null}

          {activeTab === "dispatch" ? (
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
            {shouldShowAppointmentFooter ? (
              <ShowMoreFooter
                shown={visibleAppointments.length}
                total={totalAppointments}
                onShowMore={() =>
                  setVisibleLimits((current) => ({
                    ...current,
                    appointments:
                      current.appointments + OWNER_BOARD_SHOW_MORE_INCREMENT,
                  }))
                }
              />
            ) : null}
          </OperationalCard>
          ) : null}

          {activeTab === "dispatch" ? (
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
            {shouldShowTaskFooter ? (
              <ShowMoreFooter
                shown={visibleTasks.length}
                total={totalTasks}
                onShowMore={() =>
                  setVisibleLimits((current) => ({
                    ...current,
                    tasks: current.tasks + OWNER_BOARD_SHOW_MORE_INCREMENT,
                  }))
                }
              />
            ) : null}
          </OperationalCard>
          ) : null}

          {activeTab === "refunds" ? (
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
                    currency={tenantCurrency}
                    key={refundRequest.id}
                    onAction={openAction}
                    refundRequest={refundRequest}
                  />
                ))
              ) : (
                <EmptyState message={t("owner.messages.noRefunds")} />
              )}
            </div>
            {shouldShowRefundFooter ? (
              <ShowMoreFooter
                shown={visibleRefundRequests.length}
                total={totalRefundRequests}
                onShowMore={() =>
                  setVisibleLimits((current) => ({
                    ...current,
                    refundRequests:
                      current.refundRequests + OWNER_BOARD_SHOW_MORE_INCREMENT,
                  }))
                }
              />
            ) : null}
          </OperationalCard>
          ) : null}

          {activeTab === "profile" ? (
            <OwnerProfileTab
              branchCount={branches.length}
              driverCount={drivers.length}
              isLoggingOut={isLoggingOut}
              loadTime={loadTime}
              onLogout={onLogout}
              summary={summary}
              tenantStatusLabel={t(tenantStatusLabelKeys[summary.tenantStatus])}
            />
          ) : null}

          {loadTime ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              {t("owner.updatedAt", { time: loadTime })}
            </p>
          ) : null}
        </>
      ) : null}

      <ActionSheet
        assigneeUserId={assigneeUserId}
        currency={tenantCurrency}
        drivers={drivers}
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

      <MobileTabBar
        activeValue={activeTab}
        ariaLabel={t("common.mainNavigation")}
        items={[
          {
            icon: CalendarDays,
            label: t("owner.tabs.overview"),
            value: "overview",
          },
          {
            badgeCount: dispatchSummary.pendingDispatch,
            icon: Truck,
            label: t("owner.tabs.dispatch"),
            value: "dispatch",
          },
          {
            badgeCount: boardState.refundRequests.length,
            icon: RotateCcw,
            label: t("owner.tabs.refunds"),
            value: "refunds",
          },
          {
            icon: UserRound,
            label: t("owner.tabs.profile"),
            value: "profile",
          },
        ]}
        onChange={setActiveTab}
      />
    </main>
  );
}

function OwnerProfileTab({
  branchCount,
  driverCount,
  isLoggingOut,
  loadTime,
  onLogout,
  summary,
  tenantStatusLabel,
}: {
  branchCount: number;
  driverCount: number;
  isLoggingOut: boolean;
  loadTime: string | null;
  onLogout: () => void;
  summary: MobileOwnerTodaySummary;
  tenantStatusLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-5 space-y-4">
      <SectionCard
        icon={UserRound}
        subtitle={summary.tenantName}
        title={t("owner.profile.title")}
      >
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-slate-600">{t("common.status")}</span>
            <span className="font-semibold text-emerald-700">{tenantStatusLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-slate-600">{t("owner.branch")}</span>
            <span className="font-semibold tabular-nums text-slate-950">{branchCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-slate-600">{t("owner.driver")}</span>
            <span className="font-semibold tabular-nums text-slate-950">{driverCount}</span>
          </div>
          {loadTime ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
              <span className="text-slate-600">{t("owner.profile.lastUpdated")}</span>
              <span className="font-semibold text-slate-950">{loadTime}</span>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={t("owner.profile.preferences")}>
        <LanguageSwitcher className="w-full" />
      </SectionCard>

      <Button
        className="h-11 w-full"
        disabled={isLoggingOut}
        type="button"
        variant="outline"
        onClick={onLogout}
      >
        <LogOut className="size-4" aria-hidden />
        {t("auth.logout")}
      </Button>
    </div>
  );
}
