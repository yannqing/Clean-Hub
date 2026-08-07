"use client";

import type {
  PosNoticeReadStatus,
  PosNotificationInboxItem,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";
import { PendingPrintJobs } from "@/features/hardware/components/pending-print-jobs";
import { posApi } from "@/lib/api-client";

type HeaderNotificationsMenuProps = {
  canReprint: boolean;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
  pendingPrintTaskCount: number;
  syncingPrintTaskCount: number;
  onUnreadCountChange?: (count: number) => void;
};

type LoadState = "idle" | "loading" | "success" | "error";

const MENU_LIMIT = 6;

const READ_STATUS_LABEL_KEYS: Record<PosNoticeReadStatus, TranslationKey> = {
  unread: "pos.notificationsMenu.status.unread",
  read: "pos.notificationsMenu.status.read",
  archived: "pos.notificationsMenu.status.archived",
};

const NOTICE_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  business: "pos.notificationsMenu.type.business",
  system: "pos.notificationsMenu.type.system",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatSentAt(
  value: string | null,
  locale: string,
  timeZone: string,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function getNoticeTypeLabel(
  noticeType: string,
  t: (key: TranslationKey) => string,
): string {
  const labelKey = NOTICE_TYPE_LABEL_KEYS[noticeType];
  return labelKey ? t(labelKey) : noticeType;
}

export function HeaderNotificationsMenu({
  canReprint,
  className,
  open,
  onOpenChange,
  unreadCount,
  pendingPrintTaskCount,
  syncingPrintTaskCount,
  onUnreadCountChange,
}: HeaderNotificationsMenuProps) {
  const { locale, t } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const abortRef = useRef<AbortController | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [items, setItems] = useState<PosNotificationInboxItem[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const terminalTaskCount = pendingPrintTaskCount + syncingPrintTaskCount;

  function closeMenu() {
    onOpenChange(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  async function loadNotifications() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState("loading");

    try {
      const [list, overview] = await Promise.all([
        posApi.pos.notifications.list(
          { limit: MENU_LIMIT },
          { signal: controller.signal },
        ),
        posApi.pos.notifications.overview({ signal: controller.signal }),
      ]);
      setItems(list.data);
      onUnreadCountChange?.(overview.unreadCount);
      setLoadState("success");
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setLoadState("error");
    }
  }

  async function toggleMenu() {
    const nextOpen = !open;
    if (!nextOpen) {
      closeMenu();
      return;
    }

    onOpenChange(true);
    await loadNotifications();
  }

  async function markRead(notification: PosNotificationInboxItem) {
    if (notification.readStatus !== "unread") {
      return;
    }

    setActionId(notification.id);
    try {
      const updated = await posApi.pos.notifications.markRead(notification.id);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    } catch {
      setLoadState("error");
    } finally {
      setActionId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) {
      return;
    }

    setActionId("all");
    try {
      await posApi.pos.notifications.markAllRead();
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.readStatus === "unread"
            ? { ...item, readStatus: "read", readAt: now }
            : item,
        ),
      );
      onUnreadCountChange?.(0);
    } catch {
      setLoadState("error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      }}
    >
      {open ? (
        <button
          aria-label={t("pos.notificationsMenu.close")}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={closeMenu}
          tabIndex={-1}
          type="button"
        />
      ) : null}
      <button
        aria-expanded={open}
        aria-label={
          `${
            unreadCount > 0
              ? t("pos.shell.unreadMessages", { count: unreadCount })
              : t("pos.shell.messageCenter")
          }${
            terminalTaskCount > 0
              ? `，${terminalTaskCount} 个终端打印事项`
              : ""
          }`
        }
        className={cn(
          "relative z-50 flex size-9 items-center justify-center rounded-xl text-white/75 transition-colors",
          "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          open && "bg-white/15 text-white",
        )}
        onClick={() => {
          void toggleMenu();
        }}
        type="button"
      >
        <Icon className="h-[18px] w-[18px]" name="bell" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
        {terminalTaskCount > 0 ? (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-black"
          />
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(390px,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {t("pos.notificationsMenu.title")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {unreadCount > 0
                  ? t("pos.notificationsMenu.unreadCount", {
                      count: unreadCount,
                    })
                  : t("pos.notificationsMenu.noUnread")}
              </div>
            </div>
            <button
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
              disabled={unreadCount === 0 || actionId === "all"}
              onClick={() => {
                void markAllRead();
              }}
              type="button"
            >
              {actionId === "all"
                ? t("pos.notificationsMenu.marking")
                : t("pos.notificationsMenu.markAllRead")}
            </button>
          </div>

          <PendingPrintJobs canReprint={canReprint} variant="notification" />

          <div className="pos-scrollbar max-h-[420px] overflow-y-auto">
            {loadState === "loading" || loadState === "idle" ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 animate-spin" name="rotate-ccw" />
                {t("pos.notificationsMenu.loading")}
              </div>
            ) : null}

            {loadState === "error" ? (
              <div className="px-5 py-8 text-center">
                <div className="text-sm font-semibold text-foreground">
                  {t("pos.notificationsMenu.errorTitle")}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("pos.notificationsMenu.errorHint")}
                </div>
                <button
                  className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    void loadNotifications();
                  }}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5" name="rotate-ccw" />
                  {t("common.retry")}
                </button>
              </div>
            ) : null}

            {loadState === "success" && items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-[18px] w-[18px]" name="bell" />
                </span>
                <div className="mt-3 text-sm font-semibold text-foreground">
                  {t("pos.notificationsMenu.emptyTitle")}
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("pos.notificationsMenu.emptyHint")}
                </div>
              </div>
            ) : null}

            {loadState === "success" && items.length > 0 ? (
              <div className="divide-y divide-border">
                {items.map((notification) => {
                  const unread = notification.readStatus === "unread";
                  const statusLabel = t(
                    READ_STATUS_LABEL_KEYS[notification.readStatus],
                  );
                  const sentAt = formatSentAt(
                    notification.sentAt ?? notification.createdAt,
                    locale,
                    timeZone,
                  );

                  return (
                    <article
                      className={cn(
                        "px-4 py-3.5 transition-colors",
                        unread ? "bg-muted/45" : "bg-background",
                      )}
                      key={notification.id}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            unread ? "bg-red-500" : "bg-muted-foreground/30",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                              {notification.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
                              {getNoticeTypeLabel(notification.noticeType, t)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {notification.content}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                              {[statusLabel, sentAt]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {unread ? (
                              <button
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:text-muted-foreground"
                                disabled={actionId === notification.id}
                                onClick={() => {
                                  void markRead(notification);
                                }}
                                type="button"
                              >
                                {actionId === notification.id
                                  ? t("pos.notificationsMenu.marking")
                                  : t("pos.notificationsMenu.markRead")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="border-t px-4 py-2.5">
            <Link
              className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={posRoutes.notifications}
              onClick={closeMenu}
            >
              {t("pos.notificationsMenu.viewAll")}
              <Icon className="h-4 w-4" name="chevron-right" />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
