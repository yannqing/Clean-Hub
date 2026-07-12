"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type {
  MobileDeliveryTaskStatus,
  MobileOwnerBranchOption,
  MobileOwnerDriverOption,
  MobileOwnerTodaySummary,
  MobileRefundOrderDetail,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { Button, toast } from "@cleanhub/ui";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Headphones,
  LayoutGrid,
  Languages,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MobilePageSkeleton } from "@/components/mobile-skeleton";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { MobilePullToRefresh } from "@/components/mobile-pull-to-refresh";
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
  getOwnerRefundOrderDetail,
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
  RefundRequestItem,
  RefundOrderDetailSheet,
  ShowMoreFooter,
  appointmentStatusLabelKeys,
  createMetrics,
  deliveryStatusLabelKeys,
  formatBranchOption,
  formatCount,
  formatDriverOption,
  ownerIntlLocales,
  refundStatusLabelKeys,
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
  const [dispatchView, setDispatchView] = useState<"appointments" | "tasks">("appointments");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<
    OwnerAppointmentListItem["status"] | ""
  >("");
  const [refundStatusFilter, setRefundStatusFilter] = useState<
    MobileRefundRequest["status"] | ""
  >("");
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
  const [refundOrder, setRefundOrder] = useState<MobileRefundOrderDetail | null>(null);
  const [refundOrderRequest, setRefundOrderRequest] = useState<MobileRefundRequest | null>(null);
  const [refundOrderOpen, setRefundOrderOpen] = useState(false);
  const [refundOrderLoading, setRefundOrderLoading] = useState(false);
  const [refundOrderError, setRefundOrderError] = useState<string | null>(null);

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
  const filteredAppointments = boardState.appointments.filter(
    (appointment) => !appointmentStatusFilter || appointment.status === appointmentStatusFilter,
  );
  const filteredRefundRequests = boardState.refundRequests.filter(
    (request) => !refundStatusFilter || request.status === refundStatusFilter,
  );
  const visibleAppointments = filteredAppointments.slice(
    0,
    visibleLimits.appointments,
  );
  const visibleTasks = boardState.dispatchBoard?.data.slice(0, visibleLimits.tasks) ?? [];
  const visibleRefundRequests = filteredRefundRequests.slice(
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
  const pageTitle = activeTab === "overview"
    ? t("owner.operationsToday")
    : activeTab === "dispatch"
      ? t("owner.fulfillmentCenter")
      : activeTab === "refunds"
        ? t("owner.tabs.refunds")
        : t("owner.tabs.profile");

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

  async function openRefundOrder(refundRequest: MobileRefundRequest) {
    setRefundOrder(null);
    setRefundOrderRequest(refundRequest);
    setRefundOrderError(null);
    setRefundOrderOpen(true);
    setRefundOrderLoading(true);

    try {
      setRefundOrder(await getOwnerRefundOrderDetail(refundRequest.id));
    } catch (nextError) {
      setRefundOrderError(
        getErrorMessage(nextError, t("owner.messages.refundOrderLoadFailed")),
      );
    } finally {
      setRefundOrderLoading(false);
    }
  }

  if (isLoading && !summary) {
    return <MobilePageSkeleton label={t("owner.loadingMetrics")} />;
  }

  return (
    <MobilePullToRefresh
      isRefreshing={isLoading || isBoardLoading}
      label={t("common.refresh")}
      onRefresh={() => Promise.all([loadSummary(), loadBoard()])}
    >
    <main className="mobile-page mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))]">
      <WorkspaceHeader
        eyebrow={activeTab === "overview" ? t("owner.greeting") : activeTab === "dispatch" ? null : t("owner.dispatchOwner")}
        isLoggingOut={isLoggingOut}
        logoutLabel={t("auth.logout")}
        showMenu={false}
        subtitle={summary ? summary.tenantName : t("owner.loadingTenant")}
        title={pageTitle}
        onLogout={onLogout}
      />

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
          <section className="mt-1 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <OwnerMiniMetric icon={CalendarDays} label={t("owner.appointmentStatus.pending")} tone="blue" value={summary.appointmentSummary.pending} />
              <OwnerMiniMetric icon={Users} label={t("owner.deliveryStatus.pending_dispatch")} tone="green" value={dispatchSummary.pendingDispatch} />
              <OwnerMiniMetric icon={Truck} label={t("owner.metrics.progress")} tone="amber" value={dispatchSummary.inProgress} />
              <OwnerMiniMetric icon={AlertCircle} label={t("owner.deliveryStatus.exception")} tone="red" value={dispatchSummary.exception} />
            </div>

            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1" role="tablist">
              <button
                aria-selected={dispatchView === "appointments"}
                className={`min-h-11 rounded-md text-sm font-semibold transition ${dispatchView === "appointments" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                role="tab"
                type="button"
                onClick={() => setDispatchView("appointments")}
              >
                {t("owner.sections.appointments")} {boardState.appointments.length}
              </button>
              <button
                aria-selected={dispatchView === "tasks"}
                className={`min-h-11 rounded-md text-sm font-semibold transition ${dispatchView === "tasks" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                role="tab"
                type="button"
                onClick={() => setDispatchView("tasks")}
              >
                {t("owner.sections.dispatch")} {totalTasks}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <label className="block">
                <span className="sr-only">{t("owner.branch")}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
              <label className="block">
                  <span className="sr-only">{t("owner.driver")}</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            </div>
          </section>
          ) : null}

          {activeTab === "overview" ? (
            <section className="mt-5 grid gap-4">
              <OwnerStatusPanel
                icon={CalendarDays}
                subtitle={t("owner.appointmentCount", {
                  count: formatCount(boardState.appointments.length, intlLocale),
                })}
                title={t("owner.overview.appointments")}
                values={[
                  { label: t("owner.appointmentStatus.pending"), tone: "blue", value: summary.appointmentSummary.pending },
                  { label: t("owner.appointmentStatus.accepted"), tone: "green", value: summary.appointmentSummary.accepted },
                  { label: t("owner.appointmentStatus.done"), tone: "amber", value: summary.appointmentSummary.done },
                  { label: t("owner.appointmentStatus.cancelled"), tone: "red", value: summary.appointmentSummary.cancelled },
                ]}
                onOpen={() => {
                  setDispatchView("appointments");
                  setActiveTab("dispatch");
                }}
              />
              <OwnerStatusPanel
                icon={Truck}
                subtitle={summary.featureFlags.deliveryEnabled ? t("owner.deliveryActive") : t("owner.deliveryInactive")}
                title={t("owner.sections.dispatch")}
                values={[
                  { label: t("owner.deliveryStatus.pending_dispatch"), tone: "blue", value: dispatchSummary.pendingDispatch },
                  { label: t("owner.assigned"), tone: "green", value: dispatchSummary.assigned },
                  { label: t("owner.metrics.progress"), tone: "amber", value: dispatchSummary.inProgress },
                  { label: t("owner.deliveryStatus.exception"), tone: "red", value: dispatchSummary.exception },
                ]}
                onOpen={() => {
                  setDispatchView("tasks");
                  setActiveTab("dispatch");
                }}
              />
              <OwnerRecentTasks
                tasks={boardState.dispatchBoard?.data.slice(0, 2) ?? []}
                onOpen={() => {
                  setDispatchView("tasks");
                  setActiveTab("dispatch");
                }}
              />
            </section>
          ) : null}

          {activeTab === "dispatch" && dispatchView === "appointments" ? (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">{t("owner.sections.appointments")}</h2>
              <span className="text-xs text-slate-500">{t("owner.appointmentCount", { count: formatCount(boardState.appointments.length, intlLocale) })}</span>
            </div>
            <div className="mobile-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
              {(["", "pending", "accepted", "done", "cancelled"] as const).map((status) => (
                <button
                  aria-selected={appointmentStatusFilter === status}
                  className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition ${appointmentStatusFilter === status ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"}`}
                  key={status || "all"}
                  role="tab"
                  type="button"
                  onClick={() => setAppointmentStatusFilter(status)}
                >
                  {status ? t(appointmentStatusLabelKeys[status]) : t("owner.all")}
                </button>
              ))}
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
          </section>
          ) : null}

          {activeTab === "dispatch" && dispatchView === "tasks" ? (
          <section className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">{t("owner.sections.dispatch")}</h2>
              <span className="text-xs text-slate-500">{summary.featureFlags.deliveryEnabled ? t("owner.deliveryActive") : t("owner.deliveryInactive")}</span>
            </div>
            <div className="mobile-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
              {(["", "pending_dispatch", "en_route", "delivering", "signed", "exception"] as const).map((status) => (
                <button
                  aria-selected={deliveryStatusFilter === status}
                  className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition ${deliveryStatusFilter === status ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600"}`}
                  key={status || "all"}
                  role="tab"
                  type="button"
                  onClick={() => setDeliveryStatusFilter(status)}
                >
                  {status ? t(deliveryStatusLabelKeys[status]) : t("owner.all")}
                </button>
              ))}
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
          </section>
          ) : null}

          {activeTab === "refunds" ? (
          <section className="mt-1 space-y-4">
            <div className="mobile-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist">
              {(["", "pending", "approved", "rejected", "refunded"] as const).map((status) => {
                const count = status
                  ? boardState.refundRequests.filter((request) => request.status === status).length
                  : boardState.refundRequests.length;
                return (
                  <button
                    aria-selected={refundStatusFilter === status}
                    className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition ${refundStatusFilter === status ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                    key={status || "all"}
                    role="tab"
                    type="button"
                    onClick={() => setRefundStatusFilter(status)}
                  >
                    {status ? t(refundStatusLabelKeys[status]) : t("owner.all")} {count}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-3">
              {isBoardLoading && !visibleRefundRequests.length ? (
                <EmptyState message={t("owner.messages.loadingRefunds")} />
              ) : visibleRefundRequests.length ? (
                visibleRefundRequests.map((refundRequest) => (
                  <RefundRequestItem
                    currency={tenantCurrency}
                    key={refundRequest.id}
                    onAction={openAction}
                    onViewOrder={(request) => void openRefundOrder(request)}
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
          </section>
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

      <RefundOrderDetailSheet
        currency={tenantCurrency}
        error={refundOrderError}
        isLoading={refundOrderLoading}
        open={refundOrderOpen}
        order={refundOrder}
        refundRequest={refundOrderRequest}
        onApprove={(request) => {
          setRefundOrderOpen(false);
          openAction({ kind: "approve-refund", refundRequest: request });
        }}
        onReject={(request) => {
          setRefundOrderOpen(false);
          openAction({ kind: "reject-refund", refundRequest: request });
        }}
        onOpenChange={(open) => {
          setRefundOrderOpen(open);

          if (!open) {
            setRefundOrder(null);
            setRefundOrderRequest(null);
            setRefundOrderError(null);
          }
        }}
      />

      <MobileTabBar
        activeValue={activeTab}
        ariaLabel={t("common.mainNavigation")}
        items={[
          {
            icon: LayoutGrid,
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
            badgeCount: boardState.refundRequests.filter((request) => request.status === "pending").length,
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
    </MobilePullToRefresh>
  );
}

type OwnerTone = "amber" | "blue" | "green" | "red";

const ownerToneClasses: Record<OwnerTone, string> = {
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
};

const ownerToneDotClasses: Record<OwnerTone, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
};

function OwnerMiniMetric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  tone: OwnerTone;
  value: number;
}) {
  return (
    <div className="min-h-24 rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
      <span className={`flex size-8 items-center justify-center rounded-md ${ownerToneClasses[tone]}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-2 truncate text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function OwnerStatusPanel({
  icon: Icon,
  onOpen,
  subtitle,
  title,
  values,
}: {
  icon: typeof CalendarDays;
  onOpen: () => void;
  subtitle: string;
  title: string;
  values: Array<{ label: string; tone: OwnerTone; value: number }>;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <Button className="h-9 px-2 text-slate-500" size="sm" type="button" variant="ghost" onClick={onOpen}>
          <span>{t("owner.overview.viewAll")}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-4 divide-x divide-slate-200">
        {values.map((item) => (
          <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0" key={item.label}>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
              <span className={`size-1.5 rounded-full ${ownerToneDotClasses[item.tone]}`} />
              <span className="truncate">{item.label}</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        {values.map((item) => (
          <span
            className={ownerToneDotClasses[item.tone]}
            key={item.label}
            style={{ flexGrow: Math.max(1, item.value) }}
          />
        ))}
      </div>
    </section>
  );
}

function OwnerRecentTasks({
  onOpen,
  tasks,
}: {
  onOpen: () => void;
  tasks: OwnerDispatchBoard["data"];
}) {
  const { locale, t } = useTranslation();
  const intlLocale = ownerIntlLocales[locale];
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Truck className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-bold text-slate-950">{t("owner.overview.recentTasks")}</h2>
        </div>
        <Button className="h-8 px-2 text-slate-500" size="sm" type="button" variant="ghost" onClick={onOpen}>
          {t("owner.overview.viewAll")}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {tasks.length ? tasks.map((task) => (
          <button className="flex min-h-14 w-full items-center gap-3 text-left" key={task.id} type="button" onClick={onOpen}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{task.customerName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{task.address}</p>
            </div>
            <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              {t(deliveryStatusLabelKeys[task.status])}
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {task.expectedAt ? new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(task.expectedAt)) : "-"}
            </span>
          </button>
        )) : <EmptyState message={t("owner.messages.noDeliveryTasks")} />}
      </div>
    </section>
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
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-950">{summary.tenantName}</h2>
            <span className="mt-1 inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              {t("owner.profile.ownerAccount")}
            </span>
          </div>
          <span className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            {tenantStatusLabel}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 text-center">
          <div className="px-2">
            <p className="text-xs text-slate-500">{t("owner.branch")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{branchCount}</p>
          </div>
          <div className="px-2">
            <p className="text-xs text-slate-500">{t("owner.driver")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{driverCount}</p>
          </div>
          <div className="px-2">
            <p className="text-xs text-slate-500">{t("owner.profile.lastUpdated")}</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{loadTime ?? "-"}</p>
          </div>
        </div>
      </section>

      <OwnerProfileGroup title={t("owner.profile.storeTeam")}>
        <OwnerProfileRow icon={Store} label={t("owner.profile.storeInfo")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
        <OwnerProfileRow icon={Building2} label={t("owner.profile.branchManagement")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
        <OwnerProfileRow icon={Users} label={t("owner.profile.driverManagement")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
      </OwnerProfileGroup>

      <OwnerProfileGroup title={t("owner.profile.preferences")}>
        <OwnerProfileRow icon={Languages} label={t("common.language")} trailing={<LanguageSwitcher />} />
        <OwnerProfileRow icon={Bell} label={t("owner.profile.notifications")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
        <OwnerProfileRow icon={ShieldCheck} label={t("owner.profile.security")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
      </OwnerProfileGroup>

      <OwnerProfileGroup title={t("owner.profile.helpSupport")}>
        <OwnerProfileRow icon={CircleHelp} label={t("owner.profile.helpCenter")} onClick={() => toast.info(t("owner.profile.notAvailable"))} />
        <OwnerProfileRow href="mailto:support@cleanhub.local" icon={Headphones} label={t("owner.profile.contactSupport")} />
      </OwnerProfileGroup>

      <Button
        className="h-12 w-full border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
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

function OwnerProfileGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function OwnerProfileRow({
  href,
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  href?: string;
  icon: typeof CalendarDays;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      <Icon className="size-5 shrink-0 text-blue-600" aria-hidden />
      <span className="min-w-0 flex-1 text-left text-sm font-medium text-slate-800">{label}</span>
      {trailing ?? <ChevronRight className="size-4 text-slate-400" aria-hidden />}
    </>
  );

  if (href) {
    return <a className="flex min-h-14 items-center gap-3" href={href}>{content}</a>;
  }
  if (onClick) {
    return <button className="flex min-h-14 w-full items-center gap-3" type="button" onClick={onClick}>{content}</button>;
  }
  return <div className="flex min-h-14 items-center gap-3">{content}</div>;
}
