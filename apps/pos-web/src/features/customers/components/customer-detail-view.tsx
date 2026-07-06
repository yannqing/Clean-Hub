"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  PosOrderSummary,
  ServiceTicketSummary,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import { posToast as toast } from "@/lib/pos-toast";

import { posApi } from "@/lib/api-client";

import {
  CUSTOMER_CURRENCY,
  CUSTOMER_PROFILE_RELATIONSHIPS,
  CUSTOMER_TICKET_STATUS_LABELS,
  CUSTOMER_TICKET_STATUS_TONES,
  CUSTOMER_TICKET_TYPE_LABELS,
  CUSTOMER_ORDER_PAYMENT_LABELS,
  CUSTOMER_ORDER_TYPE_LABELS,
} from "../constants";
import { changeProfileStatus, fetchCustomerOrderStats, updateProfile } from "../queries";
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
};

type DetailTab = "overview" | "tickets" | "orders" | "items" | "notes";

const TAB_LABELS: Record<DetailTab, string> = {
  overview: "概览",
  tickets: "工单管理",
  orders: "订单管理",
  items: "服务项目",
  notes: "备注",
};

export function CustomerDetailView({ customerId, from }: CustomerDetailViewProps) {
  const router = useRouter();
  const { locale } = useTranslation();

  // Whether this detail view was reached via 客户接待 (intake). Controls the
  // breadcrumb trail and the back-button destination so the clerk returns to
  // the intake page rather than the customer-management list.
  const fromIntake = from === "intake";

  const [profile, setProfile] = useState<PosCustomerProfileDetail | null>(null);
  const [account, setAccount] = useState<PosCustomerAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTicketCount, setActiveTicketCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [recentTickets, setRecentTickets] = useState<ServiceTicketSummary[]>([]);
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

      setAccount(accountDetail.status === "fulfilled" ? accountDetail.value : null);
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
      toast.error(
        error instanceof Error ? error.message : "操作失败，请重试。",
      );
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const updated = await updateProfile(customerId, { notes: notesDraft });
      setProfile(updated);
      toast.success("备注已保存");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存失败，请重试。",
      );
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
    router.push(`/tickets/${ticketId}`);
  }

  if (loading) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        未找到该客户档案。
      </div>
    );
  }

  const accountName = account?.accountName ?? "-";
  const relationshipLabel =
    profile.relationship ?? CUSTOMER_PROFILE_RELATIONSHIPS[0];

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <span>POS</span>
          <span>&gt;</span>
          <button
            className="hover:text-blue-700"
            type="button"
            onClick={() => router.push(fromIntake ? "/new-intake" : "/customers")}
          >
            {fromIntake ? "客户接待" : "客户管理"}
          </button>
          <span>&gt;</span>
          {fromIntake && (
            <>
              <span className="text-slate-400">客户服务</span>
              <span>&gt;</span>
            </>
          )}
          <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">
            {profile.fullName}
          </span>
        </div>
        <button
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          type="button"
          onClick={() => router.push(fromIntake ? "/new-intake" : "/customers")}
        >
          {fromIntake ? "返回客户接待" : "返回账户档案"}
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 text-base font-bold text-white">
            {initials(profile.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-slate-950">
                {profile.fullName}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>{profile.phone || "未填写手机号"}</span>
              <span>{profile.email || "未填写邮箱"}</span>
              <span>
                {accountName} · {relationshipLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              type="button"
              onClick={() => setDialog({ type: "edit-profile", customerId })}
            >
              编辑档案
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              type="button"
              onClick={handleCreateServiceTicket}
            >
              <span className="text-lg leading-none">+</span>
              <span>新建服务工单</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-slate-200 sm:grid-cols-4">
          {[
            { label: "账户余额", value: `${CUSTOMER_CURRENCY} 0`, hint: "暂未实现" },
            { label: "历史工单", value: String(activeTicketCount), hint: "工单总数" },
            { label: "历史订单", value: String(orderCount), hint: "订单总数" },
            {
              label: "累计消费",
              value: formatMoney(totalPaid, locale),
              hint: "已支付总额",
            },
          ].map((metric) => (
            <div
              className="border-r border-slate-100 px-5 py-4 last:border-r-0"
              key={metric.label}
            >
              <div className="text-xs font-medium text-slate-500">
                {metric.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {metric.value}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{metric.hint}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">状态：</span>
            <CustomerStatusSwitch
              kind="profile"
              status={profile.status}
              onToggle={handleToggleStatus}
            />
          </div>
        </div>
        <div className="flex flex-wrap border-t border-slate-200 px-5">
          {(Object.keys(TAB_LABELS) as DetailTab[]).map((tabKey) => (
            <button
              className={`relative h-12 px-4 text-sm font-semibold ${
                tab === tabKey
                  ? "text-blue-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
            >
              {TAB_LABELS[tabKey]}
              {tab === tabKey ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 bg-blue-600" />
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">当前服务</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    进行中的工单在全部项目完成并取件前保持开启。
                  </p>
                </div>
                <button
                  className="text-sm font-semibold text-blue-700"
                  type="button"
                  onClick={() => setTab("tickets")}
                >
                  查看工单
                </button>
              </div>
              <CurrentServiceCard locale={locale} ticket={recentTickets[0]} />
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-950">最近动态</h2>
                <button
                  className="text-sm font-semibold text-blue-700"
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
              />
            </section>
          </div>
          <aside className="space-y-5 lg:col-start-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">档案信息</h2>
              <div className="mt-4 space-y-3">
                <Detail label="档案编号" value={profile.id} mono />
                <Detail label="客户账户" value={accountName} />
                <Detail label="账户关系" value={relationshipLabel} />
                <Detail
                  label="建档时间"
                  value={formatDate(profile.createdAt, locale)}
                />
                <Detail label="地址" value={profile.address ?? "未填写"} />
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-950">服务偏好</h2>
                <button
                  className="text-xs font-semibold text-blue-700"
                  type="button"
                  onClick={() => setTab("notes")}
                >
                  管理
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {profile.notes || "暂无服务偏好记录。"}
              </p>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">档案备注</h2>
            <p className="mt-1 text-sm text-slate-500">
              该备注在选中此档案时对店员可见。
            </p>
            <textarea
              className="mt-4 min-h-[180px] w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-blue-400"
              onChange={(event) => setNotesDraft(event.target.value)}
              value={notesDraft}
            />
            <div className="mt-3 flex justify-end">
              <button
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
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
        <CustomerTicketList customerId={customerId} />
      ) : null}

      {tab === "orders" ? (
        <CustomerOrderList customerId={customerId} />
      ) : null}

      {tab === "items" ? (
        <CustomerServiceItemList customerId={customerId} />
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
    </div>
  );
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
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className={`mt-0.5 text-sm font-medium text-slate-700 ${mono ? "font-mono text-xs" : ""}`}
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
    <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">通知权限</h2>
      <div className="mt-5 space-y-4">
        {options.map((option) => (
          <label
            className="flex items-center justify-between gap-4 text-sm text-slate-700"
            key={option.key}
          >
            <span>{option.label}</span>
            <button
              aria-pressed={values[option.key]}
              className={`relative h-7 w-12 rounded-full transition ${
                values[option.key] ? "bg-blue-600" : "bg-slate-200"
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
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
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

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return [...trimmed][0]?.toUpperCase() ?? "?";
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(
  amount: string | number | null | undefined,
  locale: string,
): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return `${CUSTOMER_CURRENCY} 0`;
  return `${CUSTOMER_CURRENCY} ${value.toLocaleString(locale)}`;
}

function formatDateShort(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
}: {
  locale: string;
  ticket: ServiceTicketSummary | undefined;
}) {
  if (!ticket) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        暂无工单记录。
      </div>
    );
  }
  const tone = CUSTOMER_TICKET_STATUS_TONES[ticket.ticketStatus] ?? "bg-slate-100 text-slate-600";
  return (
    <div className="mt-4 grid grid-cols-[1fr_130px_120px] items-center rounded-lg border border-slate-200 p-4">
      <div className="min-w-0">
        <div className="font-semibold text-slate-950">
          {CUSTOMER_TICKET_TYPE_LABELS[ticket.ticketType] ?? ticket.ticketType}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          工单 {ticket.ticketNo || "—"} · {ticket.itemCount} 个项目 ·{" "}
          {formatDateShort(ticket.createdAt, locale)}
        </div>
      </div>
      <span className="text-sm text-slate-500">
        {ticket.expectedPickupAt
          ? formatDateShort(ticket.expectedPickupAt, locale)
          : "未设置取件"}
      </span>
      <span className={`justify-self-end rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}>
        {CUSTOMER_TICKET_STATUS_LABELS[ticket.ticketStatus] ?? ticket.ticketStatus}
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
}: {
  locale: string;
  tickets: ServiceTicketSummary[];
  orders: PosOrderSummary[];
}) {
  const items: Array<ActivityItem & { timestamp: string }> = [
    ...tickets
      .slice(0, 3)
      .map<ActivityItem & { timestamp: string }>((ticket) => ({
      title: "工单创建",
      detail: `${CUSTOMER_TICKET_TYPE_LABELS[ticket.ticketType] ?? ticket.ticketType} · ${ticket.itemCount} 个项目`,
      time: formatDateShort(ticket.createdAt, locale),
      timestamp: ticket.createdAt,
      amount: ticket.totalAmount
        ? formatMoney(ticket.totalAmount, locale)
        : undefined,
    })),
    ...orders
      .slice(0, 3)
      .map<ActivityItem & { timestamp: string }>((order) => ({
      title: "订单记录",
      detail: `${CUSTOMER_ORDER_TYPE_LABELS[order.orderType] ?? order.orderType} · ${CUSTOMER_ORDER_PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}`,
      time: formatDateShort(order.createdAt, locale),
      timestamp: order.createdAt,
      amount: order.totalAmount
        ? formatMoney(order.totalAmount, locale)
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
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        暂无动态记录。
      </div>
    );
  }

  return (
    <div className="mt-4 divide-y divide-slate-100">
      {items.map((item, index) => (
        <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={index}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800">{item.title}</div>
            <div className="text-xs text-slate-500">{item.detail}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">{item.time}</div>
            {item.amount ? (
              <div className="mt-1 text-sm font-semibold text-slate-950">{item.amount}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
