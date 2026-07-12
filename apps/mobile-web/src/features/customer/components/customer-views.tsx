"use client";

import { useState } from "react";
import type {
  MobileCustomerAddress,
  MobileCustomerAppointment,
  MobileCustomerContact,
  MobileCustomerOrderDetail,
  MobileCustomerProfile,
  MobileRefundRequest,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@cleanhub/ui";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Home,
  Loader2,
  MapPin,
  Plus,
  ReceiptText,
  RotateCcw,
  TicketCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { AlertBanner } from "@/components/alert-banner";
import { EmptyState } from "@/components/empty-state";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { formatTenantMoney } from "@/lib/currency";

import { getIntlLocale } from "../lib/country";
import {
  activityStatusFilters,
  amountToCents,
  appointmentTypeKeys,
  filterActivityItems,
  formatDate,
  formatDateTime,
  getAppointmentStatusView,
  getNextOverviewItem,
  getOrderBalance,
  getOrderStatusView,
  getPaymentStatusLabel,
  getReadyForPickupCount,
  getRefundStatusView,
  getTicketStatusView,
  isOpenAppointment,
  type ActivityDetail,
  type ActivityKind,
  type ActivityListItem,
  type ActivityStatusFilter,
  type StatusView,
} from "../lib/format";
import {
  CustomerAccountCard,
  CustomerAddressBookSection,
  CustomerLinkedContactsSection,
  CustomerProfileUnavailableState,
} from "./customer-profile-sections";

export type CustomerTab = "resume" | "orders" | "appointments" | "profile";

type ActivitySelection = {
  kind: ActivityKind;
  id: string;
};

const tabIcons: Record<CustomerTab, typeof Home> = {
  resume: Home,
  orders: ReceiptText,
  appointments: CalendarClock,
  profile: UserRound,
};

export function CustomerTabBar({
  activeTab,
  onChange,
}: {
  activeTab: CustomerTab;
  onChange: (tab: CustomerTab) => void;
}) {
  const { t } = useTranslation();
  const tabs = (Object.entries(tabIcons) as [CustomerTab, typeof Home][]).map(
    ([value, icon]) => ({
      icon,
      label: t(`customer.tabs.${value}` as TranslationKey),
      value,
    }),
  );

  return (
    <MobileTabBar
      activeValue={activeTab}
      ariaLabel={t("common.mainNavigation")}
      items={tabs}
      onChange={onChange}
    />
  );
}

export function AlertMessage({ message, tone }: { message: string; tone: "error" | "success" }) {
  return <AlertBanner message={message} tone={tone} />;
}

export function CustomerOverviewView({
  activityItems,
  appointments,
  currency,
  onOpenCreateAppointment,
  onSelectActivity,
  onShowAppointments,
  onShowOrders,
}: {
  activityItems: ActivityListItem[];
  appointments: MobileCustomerAppointment[];
  currency: string;
  onOpenCreateAppointment: () => void;
  onSelectActivity: (item: ActivityListItem) => void;
  onShowAppointments: () => void;
  onShowOrders: () => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);
  const activeItems = filterActivityItems(activityItems, "active");
  const openAppointments = appointments.filter(isOpenAppointment);
  const readyCount = getReadyForPickupCount(activityItems);
  const nextItem = getNextOverviewItem(activityItems, appointments);
  const hasOverviewData =
    activeItems.length > 0 || openAppointments.length > 0 || readyCount > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {t("customer.overview.next")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("customer.overview.nextSubtitle")}
            </p>
          </div>
          <CalendarClock className="size-5 text-blue-600" aria-hidden="true" />
        </div>

        {nextItem ? (
          nextItem.kind === "activity" ? (
            <button
              className="mt-4 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300"
              type="button"
              onClick={() => onSelectActivity(nextItem.activity)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {nextItem.activity.title}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {nextItem.activity.subtitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {nextItem.activity.kind === "order"
                      ? t("customer.detail.totalInline", {
                          amount: formatTenantMoney(
                            nextItem.activity.amount,
                            intlLocale,
                            currency,
                          ),
                        })
                      : nextItem.activity.expectedAt
                        ? t("customer.detail.pickupInline", {
                            date: formatDateTime(
                              nextItem.activity.expectedAt,
                              intlLocale,
                            ),
                          })
                        : formatDate(nextItem.activity.createdAt, intlLocale)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
            </button>
          ) : (
            <button
              className="mt-4 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300"
              type="button"
              onClick={onShowAppointments}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {t("customer.appointments.title")}
                  </p>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {nextItem.appointment.address}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(nextItem.appointment.expectedAt, intlLocale)}
                  </p>
                </div>
                <StatusBadge
                  view={getAppointmentStatusView(t, nextItem.appointment.status)}
                />
              </div>
            </button>
          )
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={CalendarClock}
              title={t("customer.overview.noPendingTitle")}
              body={t("customer.overview.noPendingBody")}
            />
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <OverviewMetric
          icon={ReceiptText}
          label={t("customer.overview.active")}
          value={activeItems.length}
        />
        <OverviewMetric
          icon={TicketCheck}
          label={t("customer.overview.ready")}
          value={readyCount}
        />
        <OverviewMetric
          icon={CalendarClock}
          label={t("customer.home.appointments")}
          value={openAppointments.length}
        />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11" type="button" onClick={onOpenCreateAppointment}>
            <Plus className="size-4" aria-hidden="true" />
            {t("customer.actions.newAppointment")}
          </Button>
          <Button className="h-11" type="button" variant="outline" onClick={onShowOrders}>
            <ReceiptText className="size-4" aria-hidden="true" />
            {t("customer.overview.viewTracking")}
          </Button>
        </div>
        {!hasOverviewData ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("customer.overview.emptyHint")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: number;
}) {
  return (
    <div className="min-h-32 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="mt-4 block text-3xl font-bold tabular-nums text-blue-600">
        {value}
      </span>
      <p className="mt-1 min-h-8 text-xs font-medium leading-4 text-slate-600">
        {label}
      </p>
    </div>
  );
}

export function ActivityView({
  activeFilter,
  activityItems,
  currency,
  selectedActivity,
  totalCount,
  onFilterChange,
  onSelectActivity,
}: {
  activeFilter: ActivityStatusFilter;
  activityItems: ActivityListItem[];
  currency: string;
  selectedActivity: ActivitySelection | null;
  totalCount: number;
  onFilterChange: (filter: ActivityStatusFilter) => void;
  onSelectActivity: (item: ActivityListItem) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  return (
    <div className="space-y-4">
      <div
        className="mobile-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label={t("customer.filters.label")}
      >
        {activityStatusFilters.map((filter) => {
          const isActive = activeFilter === filter;

          return (
            <button
              aria-selected={isActive}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/20"
                  : "bg-transparent text-slate-600 hover:bg-white"
              }`}
              key={filter}
              role="tab"
              type="button"
              onClick={() => onFilterChange(filter)}
            >
              {t(`customer.filters.${filter}` as TranslationKey)}
            </button>
          );
        })}
      </div>

      {activityItems.length ? (
        <section className="space-y-3">
          {activityItems.map((item) => {
            const selected = selectedActivity?.kind === item.kind && selectedActivity.id === item.id;

            return (
              <button
                className={`w-full rounded-md border bg-white p-4 text-left shadow-sm transition ${
                  selected ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"
                }`}
                key={`${item.kind}-${item.id}`}
                type="button"
                aria-haspopup="dialog"
                onClick={() => onSelectActivity(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <ActivityIcon kind={item.kind} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">{item.subtitle}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.createdAt, intlLocale)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      view={
                        item.kind === "order"
                          ? getOrderStatusView(t, item.status)
                          : getTicketStatusView(t, item.status)
                      }
                    />
                    <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 pl-14">
                  {item.kind === "order" ? (
                    <span className="text-xs font-medium text-slate-500">
                      {t("customer.detail.totalInline", {
                        amount: formatTenantMoney(
                          item.amount,
                          intlLocale,
                          currency,
                        ),
                      })}
                    </span>
                  ) : item.expectedAt ? (
                    <span className="text-xs font-medium text-slate-500">
                      {t("customer.detail.pickupInline", {
                        date: formatDateTime(item.expectedAt, intlLocale),
                      })}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </section>
      ) : totalCount ? (
        <EmptyState
          icon={ReceiptText}
          title={t("customer.empty.noFilteredTrackingTitle")}
          body={t("customer.empty.noFilteredTrackingBody")}
        />
      ) : (
        <EmptyState
          icon={ReceiptText}
          title={t("customer.empty.noOrdersTitle")}
          body={t("customer.empty.noOrdersBody")}
        />
      )}
    </div>
  );
}

export function ActivityDetailSheet({
  currency,
  detail,
  isPaymentSubmitting,
  isLoading,
  item,
  onCreatePayment,
  open,
  onOpenChange,
  onOpenRefund,
  refundRequests,
}: {
  currency: string;
  detail: ActivityDetail | null;
  isPaymentSubmitting: boolean;
  isLoading: boolean;
  item: ActivityListItem | null;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
  refundRequests: MobileRefundRequest[];
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[90dvh] p-5">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>{item?.title ?? t("customer.detail.defaultTitle")}</SheetTitle>
          <SheetDescription>
            {item?.subtitle ?? t("customer.detail.defaultSubtitle")}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden="true" />
              {t("customer.detail.loading")}
            </div>
          </div>
        ) : detail ? (
          <ActivityDetailPanel
            currency={currency}
            detail={detail}
            isPaymentSubmitting={isPaymentSubmitting}
            onCreatePayment={onCreatePayment}
            onOpenRefund={onOpenRefund}
            refundRequests={refundRequests}
          />
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {t("customer.detail.selectPrompt")}
          </p>
        )}

        <SheetFooter className="sticky bottom-0 -mx-5 mt-5 border-t border-slate-200 bg-white px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <SheetClose asChild>
            <Button className="h-11 w-full" type="button" variant="outline">
              {t("common.close")}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ActivityDetailPanel({
  currency,
  detail,
  isPaymentSubmitting,
  onCreatePayment,
  onOpenRefund,
  refundRequests,
}: {
  currency: string;
  detail: ActivityDetail;
  isPaymentSubmitting: boolean;
  onCreatePayment: (order: MobileCustomerOrderDetail) => void;
  onOpenRefund: (order: MobileCustomerOrderDetail) => void;
  refundRequests: MobileRefundRequest[];
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  if (detail.kind === "order") {
    const orderRefundRequests = refundRequests.filter(
      (refundRequest) => refundRequest.orderId === detail.data.id,
    );
    const balance = getOrderBalance(detail.data);
    const canPay =
      amountToCents(balance) > 0 &&
      detail.data.paymentStatus !== "paid" &&
      detail.data.paymentStatus !== "refunded";
    const canRefund = amountToCents(detail.data.paidAmount) > 0;
    const formatMoney = (value: string | number) =>
      formatTenantMoney(value, intlLocale, currency);

    return (
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {t("customer.detail.orderPrefix", { id: detail.data.id.slice(-6).toUpperCase() })}
            </p>
            <p className="mt-1 text-sm text-slate-600">{detail.data.orderType}</p>
          </div>
          <StatusBadge view={getOrderStatusView(t, detail.data.status)} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DetailTerm label={t("customer.detail.total")} value={formatMoney(detail.data.totalAmount)} />
          <DetailTerm label={t("customer.detail.paid")} value={formatMoney(detail.data.paidAmount)} />
          <DetailTerm
            label={t("customer.detail.payment")}
            value={getPaymentStatusLabel(t, detail.data.paymentStatus)}
          />
          <DetailTerm
            label={t("customer.detail.created")}
            value={formatDateTime(detail.data.createdAt, intlLocale)}
          />
        </dl>

        {detail.data.notes ? (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {detail.data.notes}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            disabled={!canPay || isPaymentSubmitting}
            type="button"
            onClick={() => onCreatePayment(detail.data)}
          >
            {isPaymentSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="size-4" aria-hidden="true" />
            )}
            {t("customer.actions.pay")}
          </Button>
          <Button
            className="h-11"
            disabled={!canRefund}
            type="button"
            variant="outline"
            onClick={() => onOpenRefund(detail.data)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("customer.actions.refund")}
          </Button>
        </div>

        <ItemList
          emptyLabel={t("customer.detail.noItems")}
          title={t("customer.detail.articles")}
          items={detail.data.items.map((item) => ({
            id: item.id,
            title: item.itemName,
            subtitle: `${item.quantity} x ${formatMoney(item.unitAmount)}`,
            amount: formatMoney(item.lineAmount),
          }))}
        />

        <RefundRequestList
          currency={currency}
          refundRequests={orderRefundRequests}
        />
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {detail.data.ticketNo
              ? t("customer.detail.ticketPrefix", { id: detail.data.ticketNo })
              : t("customer.detail.ticketFallback")}
          </p>
          <p className="mt-1 text-sm text-slate-600">{detail.data.ticketType}</p>
        </div>
        <StatusBadge view={getTicketStatusView(t, detail.data.ticketStatus)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <DetailTerm label={t("customer.detail.priority")} value={detail.data.priority} />
        <DetailTerm
          label={t("customer.detail.pickup")}
          value={formatDateTime(detail.data.expectedPickupAt, intlLocale)}
        />
        <DetailTerm
          label={t("customer.detail.completed")}
          value={formatDateTime(detail.data.completedAt, intlLocale)}
        />
        <DetailTerm
          label={t("customer.detail.created")}
          value={formatDateTime(detail.data.createdAt, intlLocale)}
        />
      </dl>

      {detail.data.remark ? (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {detail.data.remark}
        </p>
      ) : null}

      <ItemList
        emptyLabel={t("customer.detail.noItems")}
        title={t("customer.detail.articles")}
        items={detail.data.items.map((item) => ({
          id: item.id,
          title: item.itemName,
          subtitle: `${item.quantity} x ${formatTenantMoney(
            item.unitAmount,
            intlLocale,
            currency,
          )}${item.itemCategory ? ` - ${item.itemCategory}` : ""}`,
          amount: formatTenantMoney(item.lineAmount, intlLocale, currency),
          status: item.itemStatus,
        }))}
      />
    </section>
  );
}

function RefundRequestList({
  currency,
  refundRequests,
}: {
  currency: string;
  refundRequests: MobileRefundRequest[];
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {t("customer.detail.refundRequests")}
      </p>
      {refundRequests.length ? (
        <div className="mt-3 space-y-3">
          {refundRequests.map((refundRequest) => {
            const decision =
              refundRequest.rejectionReason ??
              refundRequest.failedReason ??
              (refundRequest.refundedAt
                ? formatDateTime(refundRequest.refundedAt, intlLocale)
                : refundRequest.approvedAt
                  ? formatDateTime(refundRequest.approvedAt, intlLocale)
                  : null);

            return (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
                key={refundRequest.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-slate-950">
                      {formatTenantMoney(refundRequest.amount, intlLocale, currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("customer.detail.refundCreated")}:{" "}
                      {formatDateTime(refundRequest.createdAt, intlLocale)}
                    </p>
                  </div>
                  <StatusBadge view={getRefundStatusView(t, refundRequest.status)} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  <span className="font-medium text-slate-900">
                    {t("customer.detail.refundReason")}:
                  </span>{" "}
                  {refundRequest.reason}
                </p>
                {decision ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {t("customer.detail.refundDecision")}: {decision}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {t("customer.detail.noRefundRequests")}
        </p>
      )}
    </div>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ItemList({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: { id: string; title: string; subtitle: string; amount: string; status?: string }[];
  title: string;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
          {items.map((item) => (
            <div className="flex items-start justify-between gap-3 p-3" key={item.id}>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{item.subtitle}</p>
                {item.status ? <p className="mt-1 text-xs text-slate-500">{item.status}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-semibold text-slate-950">{item.amount}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

export function AppointmentsView({
  appointments,
  cancellingAppointmentId,
  onCancelAppointment,
  onOpenCreateAppointment,
}: {
  appointments: MobileCustomerAppointment[];
  cancellingAppointmentId: string | null;
  onCancelAppointment: (appointmentId: string) => void;
  onOpenCreateAppointment: () => void;
}) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<"all" | MobileCustomerAppointment["status"]>("all");
  const visibleAppointments = appointments.filter(
    (appointment) => statusFilter === "all" || appointment.status === statusFilter,
  );
  const filters = ["all", "pending", "accepted", "cancelled"] as const;

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Plus className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">
              {t("customer.appointments.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("customer.appointments.subtitle")}
            </p>
          </div>
          <Button className="h-11 shrink-0" type="button" onClick={onOpenCreateAppointment}>
            <Plus className="size-4" aria-hidden="true" />
            {t("customer.appointments.new")}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-4 rounded-md border border-slate-200 bg-slate-50 p-1" role="tablist">
        {filters.map((filter) => {
          const active = statusFilter === filter;
          const label = filter === "all"
            ? t("customer.filters.all")
            : getAppointmentStatusView(t, filter).label;
          return (
            <button
              aria-selected={active}
              className={`min-h-10 rounded-md px-1 text-xs font-semibold transition ${
                active ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
              }`}
              key={filter}
              role="tab"
              type="button"
              onClick={() => setStatusFilter(filter)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {visibleAppointments.length ? (
        <section className="space-y-3">
          {visibleAppointments.map((appointment) => (
            <AppointmentCard
              appointment={appointment}
              cancellingAppointmentId={cancellingAppointmentId}
              key={appointment.id}
              onCancelAppointment={onCancelAppointment}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title={t("customer.empty.noAppointmentsTitle")}
          body={t("customer.empty.noAppointmentsBody")}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  cancellingAppointmentId,
  onCancelAppointment,
}: {
  appointment: MobileCustomerAppointment;
  cancellingAppointmentId: string | null;
  onCancelAppointment: (appointmentId: string) => void;
}) {
  const { locale, t } = useTranslation();
  const intlLocale = getIntlLocale(locale);
  const isCancelling = cancellingAppointmentId === appointment.id;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">
            {t(appointmentTypeKeys[appointment.type])}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatDateTime(appointment.expectedAt, intlLocale)}
          </p>
        </div>
        <StatusBadge view={getAppointmentStatusView(t, appointment.status)} />
      </div>

      <div className="mt-4 flex gap-3 text-sm text-slate-600">
        <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="break-words leading-6">{appointment.address}</p>
      </div>

      {appointment.notes ? (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {appointment.notes}
        </p>
      ) : null}

      {appointment.status === "pending" ? (
        <Button
          className="mt-4 h-11 w-full"
          disabled={isCancelling}
          type="button"
          variant="outline"
          onClick={() => onCancelAppointment(appointment.id)}
        >
          {isCancelling ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="size-4" aria-hidden="true" />
          )}
          {t("common.cancel")}
        </Button>
      ) : null}
    </article>
  );
}

export function ProfileView({
  addressActionId,
  addressBook,
  contactActionId,
  profile,
  onCreateAddress,
  onCreateContact,
  onDeleteAddress,
  onDeleteContact,
  onEditAddress,
  onEditContact,
  onEditProfile,
  onOpenPassword,
  onSetDefaultAddress,
}: {
  addressActionId: string | null;
  addressBook: MobileCustomerAddress[];
  contactActionId: string | null;
  profile: MobileCustomerProfile | null;
  onCreateAddress: () => void;
  onCreateContact: () => void;
  onDeleteAddress: (addressId: string) => void;
  onDeleteContact: (customerId: string) => void;
  onEditAddress: (address: MobileCustomerAddress) => void;
  onEditContact: (contact: MobileCustomerContact) => void;
  onEditProfile: () => void;
  onOpenPassword: () => void;
  onSetDefaultAddress: (addressId: string) => void;
}) {
  if (!profile) {
    return <CustomerProfileUnavailableState />;
  }

  return (
    <div className="space-y-4">
      <CustomerAccountCard
        profile={profile}
        onEditProfile={onEditProfile}
        onOpenPassword={onOpenPassword}
      />
      <CustomerAddressBookSection
        addressActionId={addressActionId}
        addressBook={addressBook}
        onCreateAddress={onCreateAddress}
        onDeleteAddress={onDeleteAddress}
        onEditAddress={onEditAddress}
        onSetDefaultAddress={onSetDefaultAddress}
      />
      <CustomerLinkedContactsSection
        contactActionId={contactActionId}
        contacts={profile.addresses}
        onCreateContact={onCreateContact}
        onDeleteContact={onDeleteContact}
        onEditContact={onEditContact}
      />
    </div>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const Icon = kind === "order" ? ReceiptText : TicketCheck;

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
      <Icon className="size-5" aria-hidden="true" />
    </div>
  );
}

function StatusBadge({ view }: { view: StatusView }) {
  return (
    <Badge className={`${view.className} rounded-md border px-2.5 py-1`} variant="outline">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {view.label}
    </Badge>
  );
}
