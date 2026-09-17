"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  PosOrderSummary,
  ServiceTicketSummary,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { PosBreadcrumb, PosDetailPageSkeleton } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { buildNewIntakePath, posRoutes } from "@/config";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posMessage } from "@/lib/pos-message";
import { posToast as toast } from "@/lib/pos-toast";
import { formatPosMoney } from "@/lib/money";

import { posApi } from "@/lib/api-client";
import {
  getOrderPaymentStatusLabel,
  getOrderTypeLabel,
} from "@/lib/order-labels";

import {
  getTicketStatusLabel,
  getTicketTypeLabel,
} from "@/lib/ticket-labels";

import {
  CUSTOMER_PROFILE_RELATIONSHIPS,
  CUSTOMER_TICKET_STATUS_TONES,
} from "../constants";
import {
  changeProfileStatus,
  fetchCustomerOrderStats,
  updateProfile,
} from "../queries";
import type {
  CustomerDialogState,
  PosCustomerAccountDetail,
  PosCustomerProfileDetail,
  ProfileFormValues,
} from "../types";
import { CustomerOrderList } from "./customer-order-list";
import { CustomerServiceItemList } from "./customer-service-item-list";
import { CustomerStatusSwitch } from "./customer-status-switch";
import { CustomerTicketList } from "./customer-ticket-list";
import { ProfileFormDialog } from "./profile-form-dialog";
import { ServiceTicketCreateDialog } from "./service-ticket-create-dialog";

type CustomerDetailViewProps = {
  customerId: string;
  /** Entry source. `intake` = arrived from 客户接待; otherwise 客户管理. */
  from?: string;
  /** Service the clerk started from, prefilled into the first ticket item. */
  serviceId?: string;
  /** Original intake search keyword so returning to 客户接待 can restore results. */
  intakeQuery?: string;
};

type DetailTab = "overview" | "tickets" | "orders" | "items" | "notes";

const TAB_LABELS: Record<DetailTab, string> = {
  overview: "概览",
  tickets: "工单管理",
  orders: "订单管理",
  items: "服务项目",
  notes: "备注",
};

export function CustomerDetailView({
  customerId,
  from,
  intakeQuery,
  serviceId,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const { currency, timeZone } = usePosRuntimeConfig();

  // Whether this detail view was reached via 客户接待 (intake). Controls the
  // breadcrumb trail and the back-button destination so the clerk returns to
  // the intake page rather than the customer-management list.
  const fromIntake = from === "intake";
  const intakeReturnPath = fromIntake
    ? buildNewIntakePath({ query: intakeQuery, serviceId })
    : "/customers";
  const buildScopedTicketDetailHref = useCallback(
    (ticketId: string) =>
      buildTicketDetailPath(ticketId, {
        fromIntake,
        intakeQuery,
        serviceId,
      }),
    [fromIntake, intakeQuery, serviceId],
  );

  const [profile, setProfile] = useState<PosCustomerProfileDetail | null>(null);
  const [account, setAccount] = useState<PosCustomerAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTicketCount, setActiveTicketCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [recentTickets, setRecentTickets] = useState<ServiceTicketSummary[]>(
    [],
  );
  const [recentOrders, setRecentOrders] = useState<PosOrderSummary[]>([]);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [dialog, setDialog] = useState<CustomerDialogState>({ type: "none" });
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notificationPermissions, setNotificationPermissions] = useState({
    pickupSms: true,
    emailReceipt: true,
    marketingMessages: false,
  });

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await posApi.pos.customers.get(customerId);
      setProfile(detail);
      setNotesDraft(detail.notes ?? "");

      const [
        accountDetail,
        ticketsResult,
        orderStats,
        recentTicketsResult,
        recentOrdersResult,
      ] = await Promise.allSettled([
        posApi.pos.accounts.get(detail.customerAccountId),
        // Total ticket count for the overview metric.
        posApi.pos.serviceTickets.list({ customerId, limit: 1, offset: 0 }),
        // Order count + lifetime paid for the overview metric.
        fetchCustomerOrderStats(customerId),
        // Recent 5 tickets for the overview preview.
        posApi.pos.serviceTickets.list({ customerId, limit: 5, offset: 0 }),
        // Recent 5 orders for the overview preview.
        posApi.pos.orders.list({ customerId, limit: 5, offset: 0 }),
      ]);

      setAccount(
        accountDetail.status === "fulfilled" ? accountDetail.value : null,
      );
      setActiveTicketCount(
        ticketsResult.status === "fulfilled" ? ticketsResult.value.total : 0,
      );
      if (orderStats.status === "fulfilled") {
        setOrderCount(orderStats.value.orderCount);
        setTotalPaid(orderStats.value.totalPaid);
      }
      if (recentTicketsResult.status === "fulfilled") {
        setRecentTickets(recentTicketsResult.value.data);
      }
      if (recentOrdersResult.status === "fulfilled") {
        setRecentOrders(recentOrdersResult.value.data);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "加载客户档案失败，请重试。",
      );
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/dependent data fetch; setState happens in the async continuation.
    void loadDetail();
  }, [loadDetail]);

  async function handleToggleStatus() {
    if (!profile) return;
    const nextStatus = profile.status === "active" ? "disabled" : "active";
    try {
      const updated = await changeProfileStatus(customerId, {
        status: nextStatus,
      });
      setProfile(updated);
      toast.success(nextStatus === "active" ? "已恢复正常" : "已停用");
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "操作失败，请重试。"));
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const updated = await updateProfile(customerId, { notes: notesDraft });
      setProfile(updated);
      toast.success("备注已保存");
    } catch (error) {
      toast.error(getPosApiErrorMessage(error, "保存失败，请重试。"));
    } finally {
      setSavingNotes(false);
    }
  }

  function handleCreateServiceTicket() {
    setTicketDialogOpen(true);
  }

  function handleTicketCreated(ticketId: string) {
    // Refresh the detail (ticket count/overview) then open the new ticket so
    // the clerk can add items and pricing next.
    void loadDetail();
    router.push(buildScopedTicketDetailHref(ticketId));
  }

  if (loading) {
    return <PosDetailPageSkeleton />;
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-[1080px] border-y bg-background px-6 py-10 text-center text-sm text-muted-foreground">
        未找到该客户档案。
      </div>
    );
  }

  const accountName = account?.accountName ?? "-";
  const relationshipLabel =
    profile.relationship ?? CUSTOMER_PROFILE_RELATIONSHIPS[0];

  return (
    <section className="mx-auto w-full max-w-[1080px] space-y-4 pb-12">
      <PosBreadcrumb
        items={[
          {
            href: intakeReturnPath,
            label: fromIntake ? "客户接待" : "客户管理",
          },
          { label: profile.fullName },
        ]}
      />

      <section className="overflow-hidden border-y bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{profile.phone || "未填写手机号"}</span>
            <span>{profile.email || "未填写邮箱"}</span>
            <span>
              {accountName} · {relationshipLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="h-9 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent"
              type="button"
              onClick={() => setDialog({ type: "edit-profile", customerId })}
            >
              编辑档案
            </button>
            <button
              className="flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90"
              type="button"
              onClick={handleCreateServiceTicket}
            >
              <span className="text-lg leading-none">+</span>
              <span>新建服务工单</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            {
              label: "账户余额",
              value: formatPosMoney(0, currency, locale),
              hint: "暂未实现",
            },
            {
              label: "历史工单",
              value: String(activeTicketCount),
              hint: "工单总数",
            },
            { label: "历史订单", value: String(orderCount), hint: "订单总数" },
            {
              label: "累计消费",
              value: formatMoney(totalPaid, locale, currency),
              hint: "已支付总额",
            },
          ].map((metric) => (
            <div
              className="border-r px-4 py-3 last:border-r-0"
              key={metric.label}
            >
              <div className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {metric.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {metric.hint}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              状态：
            </span>
            <CustomerStatusSwitch
              kind="profile"
              status={profile.status}
              onToggle={handleToggleStatus}
            />
          </div>
        </div>
        <div className="pos-scrollbar flex overflow-x-auto border-t px-4">
          {(Object.keys(TAB_LABELS) as DetailTab[]).map((tabKey) => (
            <button
              className={`relative h-10 shrink-0 px-3 text-sm font-semibold ${
                tab === tabKey
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
            >
              {TAB_LABELS[tabKey]}
              {tab === tabKey ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 bg-foreground" />
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="border-y bg-background p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">当前服务</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    进行中的工单在全部项目完成并取件前保持开启。
                  </p>
                </div>
                <button
                  className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  type="button"
                  onClick={() => setTab("tickets")}
                >
                  查看工单
                </button>
              </div>
              <CurrentServiceCard
                locale={locale}
                ticket={recentTickets[0]}
                timeZone={timeZone}
              />
            </section>
            <section className="border-y bg-background p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">最近动态</h2>
                <button
                  className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  type="button"
                  onClick={() => setTab("orders")}
                >
                  完整记录
                </button>
              </div>
              <RecentActivity
                locale={locale}
                tickets={recentTickets}
                orders={recentOrders}
                timeZone={timeZone}
              />
            </section>
          </div>
          <aside className="space-y-5 lg:col-start-2">
            <section className="border-y bg-background p-5">
              <h2 className="font-semibold text-foreground">档案信息</h2>
              <div className="mt-4 space-y-3">
                <Detail label="档案编号" value={profile.id} mono />
                <Detail label="客户账户" value={accountName} />
                <Detail label="账户关系" value={relationshipLabel} />
                <Detail
                  label="建档时间"
                  value={formatDate(profile.createdAt, locale, timeZone)}
                />
                <Detail label="地址" value={profile.address ?? "未填写"} />
              </div>
            </section>
            <section className="border-y bg-background p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">服务偏好</h2>
                <button
                  className="text-xs font-semibold text-foreground underline-offset-4 hover:underline"
                  type="button"
                  onClick={() => setTab("notes")}
                >
                  管理
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {profile.notes || "暂无服务偏好记录。"}
              </p>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="border-y bg-background p-5">
            <h2 className="font-semibold text-foreground">档案备注</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              该备注在选中此档案时对店员可见。
            </p>
            <textarea
              className="mt-4 min-h-[180px] w-full resize-none rounded-md border bg-background p-3 text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setNotesDraft(event.target.value)}
              value={notesDraft}
            />
            <div className="mt-3 flex justify-end">
              <button
                className="h-9 rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
                disabled={savingNotes}
                type="button"
                onClick={handleSaveNotes}
              >
                {savingNotes ? "保存中…" : "保存备注"}
              </button>
            </div>
          </section>
          <NotificationPermissionsPanel
            values={notificationPermissions}
            onChange={setNotificationPermissions}
          />
        </div>
      ) : null}

      {tab === "tickets" ? (
        <CustomerTicketList
          customerId={customerId}
          ticketDetailHref={buildScopedTicketDetailHref}
        />
      ) : null}

      {tab === "orders" ? <CustomerOrderList customerId={customerId} /> : null}

      {tab === "items" ? (
        <CustomerServiceItemList
          customerId={customerId}
          ticketDetailHref={buildScopedTicketDetailHref}
        />
      ) : null}

      <ProfileFormDialog
        accounts={
          account
            ? [
                {
                  id: account.id,
                  accountName: account.accountName,
                  phone: account.phone,
                  email: account.email,
                  status: account.status,
                  createdAt: account.createdAt,
                },
              ]
            : []
        }
        customerId={customerId}
        initial={
          profile
            ? ({
                customerAccountId: profile.customerAccountId,
                fullName: profile.fullName,
                phone: profile.phone ?? "",
                email: profile.email ?? "",
                relationship: profile.relationship ?? "本人",
                address: profile.address ?? "",
                notes: profile.notes ?? "",
              } satisfies ProfileFormValues)
            : undefined
        }
        key={`edit-profile-${customerId}`}
        mode="edit"
        onOpenChange={(open) => {
          if (!open) setDialog({ type: "none" });
        }}
        onSaved={(updated) => {
          setProfile(updated);
        }}
        open={dialog.type === "edit-profile"}
      />

      <ServiceTicketCreateDialog
        customerId={customerId}
        customerName={profile.fullName}
        onCreated={handleTicketCreated}
        onOpenChange={setTicketDialogOpen}
        open={ticketDialogOpen}
      />
    </section>
  );
}

function buildTicketDetailPath(
  ticketId: string,
  context: {
    fromIntake: boolean;
    intakeQuery: string | undefined;
    serviceId?: string;
  },
): string {
  const params = new URLSearchParams({
    from: context.fromIntake ? "intake" : "customer",
  });
  const keyword = context.intakeQuery?.trim();
  if (context.fromIntake && keyword) {
    params.set("q", keyword);
  }
  if (context.serviceId) {
    params.set("serviceId", context.serviceId);
  }

  return `${posRoutes.ticketDetail(ticketId)}?${params.toString()}`;
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

type NotificationPermissions = {
  pickupSms: boolean;
  emailReceipt: boolean;
  marketingMessages: boolean;
};

function NotificationPermissionsPanel({
  values,
  onChange,
}: {
  values: NotificationPermissions;
  onChange: (values: NotificationPermissions) => void;
}) {
  const options: Array<{
    key: keyof NotificationPermissions;
    label: string;
  }> = [
    { key: "pickupSms", label: "短信取件通知" },
    { key: "emailReceipt", label: "邮件收据" },
    { key: "marketingMessages", label: "营销消息" },
  ];

  return (
    <aside className="border-y bg-background p-5">
      <h2 className="font-semibold text-foreground">通知权限</h2>
      <div className="mt-5 space-y-4">
        {options.map((option) => (
          <label
            className="flex items-center justify-between gap-4 text-sm text-foreground"
            key={option.key}
          >
            <span>{option.label}</span>
            <button
              aria-pressed={values[option.key]}
              className={`relative h-7 w-12 rounded-full transition ${
                values[option.key] ? "bg-foreground" : "bg-muted"
              }`}
              type="button"
              onClick={() =>
                onChange({
                  ...values,
                  [option.key]: !values[option.key],
                })
              }
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-background ring-1 ring-border transition ${
                  values[option.key] ? "left-6" : "left-1"
                }`}
              />
            </button>
          </label>
        ))}
      </div>
    </aside>
  );
}

function formatDate(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function formatMoney(
  amount: string | number | null | undefined,
  locale: string,
  currency: string,
): string {
  return formatPosMoney(amount, currency, locale);
}

function formatDateShort(
  iso: string,
  locale: string,
  timeZone: string,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/**
 * The single most-recent ticket shown as a highlighted "current service" card,
 * mirroring the prototype overview. Empty state when the customer has no
 * tickets.
 */
function CurrentServiceCard({
  locale,
  ticket,
  timeZone,
}: {
  locale: string;
  ticket: ServiceTicketSummary | undefined;
  timeZone: string;
}) {
  if (!ticket) {
    return (
      <div className="mt-4 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        暂无工单记录。
      </div>
    );
  }
  const tone =
    CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ??
    "bg-muted text-muted-foreground";
  return (
    <div className="mt-4 grid gap-3 border-y py-4 sm:grid-cols-[minmax(0,1fr)_130px_120px] sm:items-center">
      <div className="min-w-0">
        <div className="font-semibold text-foreground">
          {getTicketTypeLabel(ticket.ticketType)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          工单 {ticket.ticketNo || "—"} · {ticket.itemCount} 个项目 ·{" "}
          {formatDateShort(ticket.createdAt, locale, timeZone)}
        </div>
      </div>
      <span className="text-sm text-muted-foreground">
        {ticket.expectedPickupAt
          ? formatDateShort(ticket.expectedPickupAt, locale, timeZone)
          : "未设置取件"}
      </span>
      <span
        className={`justify-self-end rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
      >
        {getTicketStatusLabel(ticket.ticketStatus)}
      </span>
    </div>
  );
}

type ActivityItem = {
  title: string;
  detail: string;
  time: string;
  amount?: string;
};

/**
 * Recent-activity timeline blending ticket and order events, newest first.
 * Mirrors the prototype `activity()` rows.
 */
function RecentActivity({
  locale,
  tickets,
  orders,
  timeZone,
}: {
  locale: string;
  tickets: ServiceTicketSummary[];
  orders: PosOrderSummary[];
  timeZone: string;
}) {
  const items: Array<ActivityItem & { timestamp: string }> = [
    ...tickets
      .slice(0, 3)
      .map<ActivityItem & { timestamp: string }>((ticket) => ({
        title: "工单创建",
        detail: `${getTicketTypeLabel(ticket.ticketType)} · ${posMessage(
          "pos.inline.projectCount",
          { count: ticket.itemCount },
        )}`,
        time: formatDateShort(ticket.createdAt, locale, timeZone),
        timestamp: ticket.createdAt,
        amount: ticket.totalAmount
          ? formatMoney(ticket.totalAmount, locale, ticket.currency)
          : undefined,
      })),
    ...orders
      .slice(0, 3)
      .map<ActivityItem & { timestamp: string }>((order) => ({
        title: "订单记录",
        detail: `${getOrderTypeLabel(order.orderType)} · ${getOrderPaymentStatusLabel(order.paymentStatus)}`,
        time: formatDateShort(order.createdAt, locale, timeZone),
        timestamp: order.createdAt,
        amount: order.totalAmount
          ? formatMoney(order.totalAmount, locale, order.currency)
          : undefined,
      })),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 6);

  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        暂无动态记录。
      </div>
    );
  }

  return (
    <div className="mt-4 divide-y">
      {items.map((item, index) => (
        <div
          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          key={index}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {item.title}
            </div>
            <div className="text-xs text-muted-foreground">{item.detail}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{item.time}</div>
            {item.amount ? (
              <div className="mt-1 text-sm font-semibold text-foreground">
                {item.amount}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
