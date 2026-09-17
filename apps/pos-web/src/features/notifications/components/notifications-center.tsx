"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import type { PosNotificationInboxItem } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";

import {
  Icon,
  PosBreadcrumb,
  PosMetricStrip,
  PosPageHeader,
  PosTableSurface,
} from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";
import { PendingPrintJobs } from "@/features/hardware/components/pending-print-jobs";
import {
  getNoticePriorityLabel,
  getNoticePriorityOptions,
  getNoticeReadStatusLabel,
  getNoticeReadStatusOptions,
  getNoticeRelatedTypeLabel,
  getNoticeRelatedTypeOptions,
  getNoticeTypeLabel,
  getNoticeTypeOptions,
} from "@/lib/notice-labels";

import {
  archiveNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../actions";
import {
  formatNotificationDateTime,
  getNotificationDateGroup,
  NOTIFICATION_FILTER_KEYS,
} from "../constants";
import type {
  NotificationActionResult,
  PosNotificationOverview,
} from "../types";

type NotificationsCenterProps = {
  canReprint: boolean;
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
  critical: "bg-destructive/10 text-destructive",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
} as const;

const READ_STATUS_BADGE_CLASSES = {
  unread: "bg-accent text-accent-foreground",
  read: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground",
} as const;

const NOTICE_TYPE_BADGE_CLASSES = {
  business: "bg-accent text-accent-foreground",
  system: "bg-muted text-muted-foreground",
} as const;

export function NotificationsCenter({
  canReprint,
  notifications,
  overview,
  total,
}: NotificationsCenterProps) {
  const router = useRouter();
  const { timeZone } = usePosRuntimeConfig();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(
    params.get(NOTIFICATION_FILTER_KEYS.q) ?? "",
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selected =
    notifications.find((notification) => notification.id === selectedId) ??
    null;

  const grouped = useMemo(() => {
    const initial: Record<NotificationGroupKey, PosNotificationInboxItem[]> = {
      today: [],
      yesterday: [],
      older: [],
    };

    for (const notification of notifications) {
      initial[getNotificationDateGroup(notification, timeZone)].push(
        notification,
      );
    }

    return initial;
  }, [notifications, timeZone]);

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
        router.replace(`/notifications?${search.toString()}`, {
          scroll: false,
        });
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
    <section className="space-y-7 pb-8">
      <PosBreadcrumb items={[{ label: "通知中心" }]} />

      <PosPageHeader
        actions={
          <button
            className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || overview.unreadCount === 0}
            onClick={() => runAction(markAllNotificationsReadAction)}
            type="button"
          >
            <Icon className="h-4 w-4" name="bell" />
            全部已读
          </button>
        }
        description="查看系统与业务通知，处理未读消息并跳转到关联订单或工单。"
        icon="bell"
        title="通知中心"
      />

      <NotificationMetrics overview={overview} />

      <PendingPrintJobs canReprint={canReprint} variant="center" />

      <PosTableSurface>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" name="search" />
            通知筛选
          </div>
          <div className="text-xs text-muted-foreground">
            当前结果 · 共 {total} 条
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="flex h-8 min-w-[240px] flex-1 items-center rounded-md border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring">
            <Icon
              className="mr-2 h-4 w-4 text-muted-foreground"
              name="search"
            />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
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
            options={getNoticeTypeOptions()}
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
            options={getNoticeReadStatusOptions()}
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
            options={getNoticePriorityOptions()}
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
            options={getNoticeRelatedTypeOptions()}
            placeholder="全部关联"
            value={params.get(NOTIFICATION_FILTER_KEYS.relatedType) ?? ""}
          />
          <button
            className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold text-foreground hover:bg-accent"
            disabled={isPending}
            onClick={() => router.replace("/notifications", { scroll: false })}
            type="button"
          >
            <Icon className="h-4 w-4" name="rotate-ccw" />
            重置
          </button>
        </div>
      </PosTableSurface>

      {actionMessage ? (
        <div className="border-y bg-background px-4 py-3 text-sm text-muted-foreground">
          {actionMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <PosTableSurface className="overflow-hidden">
          <div className="border-b px-3 py-3">
            <h2 className="text-sm font-semibold text-foreground">通知列表</h2>
            <p className="mt-1 text-xs text-muted-foreground">
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
        </PosTableSurface>

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
    <PosMetricStrip
      ariaLabel="通知概览"
      metrics={[
        {
          icon: "bell",
          label: "未读通知",
          note: "当前未处理",
          value: overview.unreadCount,
        },
        {
          icon: "alert",
          label: "紧急未读",
          note: "高优先级与紧急",
          value: overview.urgentUnreadCount,
        },
        {
          icon: "receipt",
          label: "业务通知",
          note: "订单与工单相关",
          value: overview.businessCount,
        },
        {
          icon: "settings",
          label: "系统通知",
          note: "门店与系统消息",
          value: overview.systemCount,
        },
      ]}
    />
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
      <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
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
  const { timeZone } = usePosRuntimeConfig();
  const { locale } = useTranslation();

  return (
    <div
      className={`border-b px-3 py-3 ${
        isSelected ? "bg-accent" : "hover:bg-muted/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpen(notification)}
          type="button"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {notification.title}
            </span>
            {notification.readStatus === "unread" ? (
              <span className="h-2 w-2 rounded-full bg-foreground" />
            ) : null}
          </div>
          <p className="mt-1 max-h-10 overflow-hidden text-sm text-muted-foreground">
            {notification.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatNotificationDateTime(
                notification.sentAt,
                locale,
                timeZone,
              )}
            </span>
            {notification.relatedType ? (
              <span>
                {getNoticeRelatedTypeLabel(notification.relatedType)} ·{" "}
                {notification.relatedId ?? "-"}
              </span>
            ) : null}
          </div>
        </button>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-1.5">
            <NotificationBadge
              className={NOTICE_TYPE_BADGE_CLASSES[notification.noticeType]}
              label={getNoticeTypeLabel(notification.noticeType)}
            />
            <NotificationBadge
              className={PRIORITY_BADGE_CLASSES[notification.priority]}
              label={getNoticePriorityLabel(notification.priority)}
            />
            <NotificationBadge
              className={READ_STATUS_BADGE_CLASSES[notification.readStatus]}
              label={getNoticeReadStatusLabel(notification.readStatus)}
            />
          </div>
          <div className="flex justify-end gap-1">
            <button
              className="flex h-8 items-center rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || notification.readStatus !== "unread"}
              onClick={() => onMarkRead(notification.id)}
              type="button"
            >
              已读
            </button>
            <button
              className="flex h-8 items-center rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();

  if (!notification) {
    return (
      <aside className="border-y bg-background p-5 text-sm text-muted-foreground">
        选择一条通知查看详情。
      </aside>
    );
  }

  const relatedHref = getRelatedHref(notification);

  return (
    <aside className="border-y bg-background">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">通知详情</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNotificationDateTime(
                notification.sentAt,
                locale,
                timeZone,
              )}
            </p>
          </div>
          <NotificationBadge
            className={READ_STATUS_BADGE_CLASSES[notification.readStatus]}
            label={getNoticeReadStatusLabel(notification.readStatus)}
          />
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <NotificationBadge
              className={NOTICE_TYPE_BADGE_CLASSES[notification.noticeType]}
              label={getNoticeTypeLabel(notification.noticeType)}
            />
            <NotificationBadge
              className={PRIORITY_BADGE_CLASSES[notification.priority]}
              label={getNoticePriorityLabel(notification.priority)}
            />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-foreground">
            {notification.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {notification.content}
          </p>
        </div>

        {notification.relatedType && notification.relatedId ? (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="text-xs font-medium text-muted-foreground">
              关联对象
            </div>
            <div className="mt-1 font-mono text-xs font-semibold text-foreground">
              {getNoticeRelatedTypeLabel(notification.relatedType)} ·{" "}
              {notification.relatedId}
            </div>
            {relatedHref ? (
              <Link
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background hover:bg-foreground/90"
                href={relatedHref}
              >
                <Icon className="h-4 w-4" name="chevron-right" />
                打开关联详情
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <button
            className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || notification.readStatus !== "unread"}
            onClick={() => onMarkRead(notification.id)}
            type="button"
          >
            <Icon className="h-4 w-4" name="bell" />
            标记已读
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
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
    <label className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="bg-transparent text-xs text-foreground outline-none"
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
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" name="bell" />
      </span>
      <div className="mt-3 font-semibold text-foreground">暂无匹配通知</div>
      <div className="mt-1 text-sm text-muted-foreground">
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
