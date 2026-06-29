"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import type { PosNotificationInboxItem } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";

import {
  archiveNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../actions";
import {
  formatNotificationDateTime,
  getNotificationDateGroup,
  NOTICE_PRIORITY_LABELS,
  NOTICE_PRIORITY_OPTIONS,
  NOTICE_READ_STATUS_LABELS,
  NOTICE_READ_STATUS_OPTIONS,
  NOTICE_RELATED_TYPE_LABELS,
  NOTICE_RELATED_TYPE_OPTIONS,
  NOTICE_TYPE_LABELS,
  NOTICE_TYPE_OPTIONS,
  NOTIFICATION_FILTER_KEYS,
} from "../constants";
import type { NotificationActionResult, PosNotificationOverview } from "../types";

type NotificationsCenterProps = {
  notifications: PosNotificationInboxItem[];
  overview: PosNotificationOverview;
  total: number;
};

type NotificationGroupKey = "today" | "yesterday" | "older";

const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  today: "今天",
  yesterday: "昨天",
  older: "更早",
};

const PRIORITY_BADGE_CLASSES = {
  critical: "bg-red-50 text-red-700",
  high: "bg-amber-50 text-amber-700",
  normal: "bg-slate-100 text-slate-600",
  low: "bg-slate-100 text-slate-500",
} as const;

const READ_STATUS_BADGE_CLASSES = {
  unread: "bg-blue-50 text-blue-700",
  read: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-500",
} as const;

const NOTICE_TYPE_BADGE_CLASSES = {
  business: "bg-violet-50 text-violet-700",
  system: "bg-slate-100 text-slate-600",
} as const;

export function NotificationsCenter({
  notifications,
  overview,
  total,
}: NotificationsCenterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(params.get(NOTIFICATION_FILTER_KEYS.q) ?? "");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selected =
    notifications.find((notification) => notification.id === selectedId) ?? null;

  const grouped = useMemo(() => {
    const initial: Record<NotificationGroupKey, PosNotificationInboxItem[]> = {
      today: [],
      yesterday: [],
      older: [],
    };

    for (const notification of notifications) {
      initial[getNotificationDateGroup(notification)].push(notification);
    }

    return initial;
  }, [notifications]);

  const applyFilters = useCallback(
    (next: Record<string, string | undefined>) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (!value) {
          search.delete(key);
        } else {
          search.set(key, value);
        }
      }

      startTransition(() => {
        router.replace(`/notifications?${search.toString()}`, { scroll: false });
      });
    },
    [params, router],
  );

  const runAction = useCallback(
    <TPayload,>(task: () => Promise<NotificationActionResult<TPayload>>) => {
      setActionMessage(null);
      startTransition(() => {
        void task().then((result) => {
          setActionMessage(result.message);
          router.refresh();
        });
      });
    },
    [router],
  );

  const openNotification = useCallback(
    (notification: PosNotificationInboxItem) => {
      setSelectedId(notification.id);
      if (notification.readStatus === "unread") {
        runAction(() => markNotificationReadAction(notification.id));
      }
    },
    [runAction],
  );

  return (
    <section>
      <div className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <span>POS</span>
        <Icon className="h-3.5 w-3.5" name="chevron-right" />
        <span className="text-slate-600">通知中心</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            通知中心
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            查看系统与业务通知，处理未读消息并跳转到关联订单或工单。
          </p>
        </div>
        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending || overview.unreadCount === 0}
          onClick={() => runAction(markAllNotificationsReadAction)}
          type="button"
        >
          <Icon className="h-4 w-4 text-blue-600" name="bell" />
          全部已读
        </button>
      </div>

      <NotificationMetrics overview={overview} />

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Icon className="h-4 w-4 text-blue-600" name="search" />
            通知筛选
          </div>
          <div className="text-xs text-slate-500">当前结果 · 共 {total} 条</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <div className="flex h-10 min-w-[260px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white">
            <Icon className="mr-2 h-4 w-4 text-slate-400" name="search" />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (params.get(NOTIFICATION_FILTER_KEYS.q) ?? "")) {
                  applyFilters({
                    [NOTIFICATION_FILTER_KEYS.q]: value || undefined,
                  });
                }
              }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters({
                    [NOTIFICATION_FILTER_KEYS.q]: draft.trim() || undefined,
                  });
                }
              }}
              placeholder="标题、内容、关联 ID"
              value={draft}
            />
          </div>
          <FilterSelect
            label="类型"
            onChange={(value) =>
              applyFilters({
                [NOTIFICATION_FILTER_KEYS.noticeType]: value || undefined,
              })
            }
            options={NOTICE_TYPE_OPTIONS}
            placeholder="全部类型"
            value={params.get(NOTIFICATION_FILTER_KEYS.noticeType) ?? ""}
          />
          <FilterSelect
            label="状态"
            onChange={(value) =>
              applyFilters({
                [NOTIFICATION_FILTER_KEYS.readStatus]: value || undefined,
              })
            }
            options={NOTICE_READ_STATUS_OPTIONS}
            placeholder="全部状态"
            value={params.get(NOTIFICATION_FILTER_KEYS.readStatus) ?? ""}
          />
          <FilterSelect
            label="优先级"
            onChange={(value) =>
              applyFilters({
                [NOTIFICATION_FILTER_KEYS.priority]: value || undefined,
              })
            }
            options={NOTICE_PRIORITY_OPTIONS}
            placeholder="全部优先级"
            value={params.get(NOTIFICATION_FILTER_KEYS.priority) ?? ""}
          />
          <FilterSelect
            label="关联"
            onChange={(value) =>
              applyFilters({
                [NOTIFICATION_FILTER_KEYS.relatedType]: value || undefined,
              })
            }
            options={NOTICE_RELATED_TYPE_OPTIONS}
            placeholder="全部关联"
            value={params.get(NOTIFICATION_FILTER_KEYS.relatedType) ?? ""}
          />
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            disabled={isPending}
            onClick={() => router.replace("/notifications", { scroll: false })}
            type="button"
          >
            <Icon className="h-4 w-4" name="rotate-ccw" />
            重置
          </button>
        </div>
      </section>

      {actionMessage ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {actionMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_420px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">通知列表</h2>
            <p className="mt-1 text-xs text-slate-500">
              默认显示未归档通知，按送达时间倒序排列。
            </p>
          </div>
          {notifications.length === 0 ? (
            <NotificationsEmptyState />
          ) : (
            <div>
              {(["today", "yesterday", "older"] as const).map((group) =>
                grouped[group].length > 0 ? (
                  <NotificationGroup
                    disabled={isPending}
                    key={group}
                    label={GROUP_LABELS[group]}
                    notifications={grouped[group]}
                    onArchive={(deliveryId) =>
                      runAction(() => archiveNotificationAction(deliveryId))
                    }
                    onMarkRead={(deliveryId) =>
                      runAction(() => markNotificationReadAction(deliveryId))
                    }
                    onOpen={openNotification}
                    selectedId={selected?.id ?? null}
                  />
                ) : null,
              )}
            </div>
          )}
        </section>

        <NotificationDetailPanel
          disabled={isPending}
          notification={selected}
          onArchive={(deliveryId) =>
            runAction(() => archiveNotificationAction(deliveryId))
          }
          onMarkRead={(deliveryId) =>
            runAction(() => markNotificationReadAction(deliveryId))
          }
        />
      </div>
    </section>
  );
}

function NotificationMetrics({
  overview,
}: {
  overview: PosNotificationOverview;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        icon="bell"
        label="未读通知"
        note="当前未处理"
        tone="blue"
        value={overview.unreadCount}
      />
      <MetricCard
        icon="alert"
        label="紧急未读"
        note="高优先级与紧急"
        tone="amber"
        value={overview.urgentUnreadCount}
      />
      <MetricCard
        icon="receipt"
        label="业务通知"
        note="订单与工单相关"
        tone="violet"
        value={overview.businessCount}
      />
      <MetricCard
        icon="settings"
        label="系统通知"
        note="门店与系统消息"
        tone="slate"
        value={overview.systemCount}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tone: "blue" | "amber" | "violet" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="h-4 w-4" name={icon} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{note}</div>
    </section>
  );
}

function NotificationGroup({
  label,
  notifications,
  selectedId,
  disabled,
  onOpen,
  onMarkRead,
  onArchive,
}: {
  label: string;
  notifications: PosNotificationInboxItem[];
  selectedId: string | null;
  disabled: boolean;
  onOpen: (notification: PosNotificationInboxItem) => void;
  onMarkRead: (deliveryId: string) => void;
  onArchive: (deliveryId: string) => void;
}) {
  return (
    <div>
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-500">
        {label}
      </div>
      {notifications.map((notification) => (
        <NotificationRow
          disabled={disabled}
          isSelected={notification.id === selectedId}
          key={notification.id}
          notification={notification}
          onArchive={onArchive}
          onMarkRead={onMarkRead}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function NotificationRow({
  notification,
  isSelected,
  disabled,
  onOpen,
  onMarkRead,
  onArchive,
}: {
  notification: PosNotificationInboxItem;
  isSelected: boolean;
  disabled: boolean;
  onOpen: (notification: PosNotificationInboxItem) => void;
  onMarkRead: (deliveryId: string) => void;
  onArchive: (deliveryId: string) => void;
}) {
  return (
    <div
      className={`border-b border-slate-100 px-5 py-4 ${
        isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpen(notification)}
          type="button"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-950">
              {notification.title}
            </span>
            {notification.readStatus === "unread" ? (
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            ) : null}
          </div>
          <p className="mt-1 max-h-10 overflow-hidden text-sm text-slate-500">
            {notification.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{formatNotificationDateTime(notification.sentAt)}</span>
            {notification.relatedType ? (
              <span>
                {NOTICE_RELATED_TYPE_LABELS[notification.relatedType]} ·{" "}
                {notification.relatedId ?? "-"}
              </span>
            ) : null}
          </div>
        </button>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-1.5">
            <NotificationBadge
              className={NOTICE_TYPE_BADGE_CLASSES[notification.noticeType]}
              label={NOTICE_TYPE_LABELS[notification.noticeType]}
            />
            <NotificationBadge
              className={PRIORITY_BADGE_CLASSES[notification.priority]}
              label={NOTICE_PRIORITY_LABELS[notification.priority]}
            />
            <NotificationBadge
              className={READ_STATUS_BADGE_CLASSES[notification.readStatus]}
              label={NOTICE_READ_STATUS_LABELS[notification.readStatus]}
            />
          </div>
          <div className="flex justify-end gap-1">
            <button
              className="flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || notification.readStatus !== "unread"}
              onClick={() => onMarkRead(notification.id)}
              type="button"
            >
              已读
            </button>
            <button
              className="flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || notification.readStatus === "archived"}
              onClick={() => onArchive(notification.id)}
              type="button"
            >
              归档
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationDetailPanel({
  notification,
  disabled,
  onMarkRead,
  onArchive,
}: {
  notification: PosNotificationInboxItem | null;
  disabled: boolean;
  onMarkRead: (deliveryId: string) => void;
  onArchive: (deliveryId: string) => void;
}) {
  if (!notification) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        选择一条通知查看详情。
      </aside>
    );
  }

  const relatedHref = getRelatedHref(notification);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">通知详情</h2>
            <p className="mt-1 text-xs text-slate-500">
              {formatNotificationDateTime(notification.sentAt)}
            </p>
          </div>
          <NotificationBadge
            className={READ_STATUS_BADGE_CLASSES[notification.readStatus]}
            label={NOTICE_READ_STATUS_LABELS[notification.readStatus]}
          />
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <NotificationBadge
              className={NOTICE_TYPE_BADGE_CLASSES[notification.noticeType]}
              label={NOTICE_TYPE_LABELS[notification.noticeType]}
            />
            <NotificationBadge
              className={PRIORITY_BADGE_CLASSES[notification.priority]}
              label={NOTICE_PRIORITY_LABELS[notification.priority]}
            />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {notification.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {notification.content}
          </p>
        </div>

        {notification.relatedType && notification.relatedId ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-400">关联对象</div>
            <div className="mt-1 font-mono text-xs font-semibold text-slate-700">
              {NOTICE_RELATED_TYPE_LABELS[notification.relatedType]} ·{" "}
              {notification.relatedId}
            </div>
            {relatedHref ? (
              <Link
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                href={relatedHref}
              >
                <Icon className="h-4 w-4" name="chevron-right" />
                打开关联详情
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || notification.readStatus !== "unread"}
            onClick={() => onMarkRead(notification.id)}
            type="button"
          >
            <Icon className="h-4 w-4" name="bell" />
            标记已读
          </button>
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || notification.readStatus === "archived"}
            onClick={() => onArchive(notification.id)}
            type="button"
          >
            <Icon className="h-4 w-4" name="trash" />
            归档
          </button>
        </div>
      </div>
    </aside>
  );
}

function NotificationBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
      <span className="font-medium text-slate-500">{label}</span>
      <select
        className="bg-transparent text-sm text-slate-700 outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotificationsEmptyState() {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" name="bell" />
      </span>
      <div className="mt-3 font-semibold text-slate-700">暂无匹配通知</div>
      <div className="mt-1 text-sm text-slate-400">
        调整筛选条件后重试，或查看已归档通知。
      </div>
    </div>
  );
}

function getRelatedHref(notification: PosNotificationInboxItem): string | null {
  if (!notification.relatedId) {
    return null;
  }

  if (notification.relatedType === "order") {
    return posRoutes.orderDetail(notification.relatedId);
  }
  if (notification.relatedType === "ticket") {
    return posRoutes.ticketDetail(notification.relatedId);
  }
  return null;
}
