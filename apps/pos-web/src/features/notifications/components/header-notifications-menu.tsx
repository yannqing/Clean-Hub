"use client";

import type {
  PosNoticeReadStatus,
  PosNotificationInboxItem,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";
import Link from "next/link";
import { useRef, useState } from "react";

import { Icon } from "@/components/app-shell";
import { posRoutes } from "@/config";
import { posApi } from "@/lib/api-client";

type HeaderNotificationsMenuProps = {
  unreadCount: number;
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

function formatSentAt(value: string | null, locale: string): string {
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
  unreadCount,
  onUnreadCountChange,
}: HeaderNotificationsMenuProps) {
  const { locale, t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [items, setItems] = useState<PosNotificationInboxItem[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  function closeMenu() {
    setOpen(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }

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

    setOpen(true);
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
      ref={rootRef}
      className="relative"
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
          unreadCount > 0
            ? t("pos.shell.unreadMessages", { count: unreadCount })
            : t("pos.shell.messageCenter")
        }
        className="relative z-50 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        onClick={() => {
          void toggleMenu();
        }}
        type="button"
      >
        <Icon className="h-[18px] w-[18px]" name="bell" />
        {unreadCount > 0 ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-950">
                {t("pos.notificationsMenu.title")}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {unreadCount > 0
                  ? t("pos.notificationsMenu.unreadCount", {
                      count: unreadCount,
                    })
                  : t("pos.notificationsMenu.noUnread")}
              </div>
            </div>
            <button
              className="rounded-md px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
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

          <div className="pos-scrollbar max-h-[390px] overflow-y-auto">
            {loadState === "loading" ? (
              <div className="px-4 py-6 text-sm font-medium text-slate-500">
                {t("pos.notificationsMenu.loading")}
              </div>
            ) : null}

            {loadState === "error" ? (
              <div className="px-4 py-6">
                <div className="text-sm font-semibold text-slate-900">
                  {t("pos.notificationsMenu.errorTitle")}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {t("pos.notificationsMenu.errorHint")}
                </div>
              </div>
            ) : null}

            {loadState === "success" && items.length === 0 ? (
              <div className="px-4 py-6">
                <div className="text-sm font-semibold text-slate-900">
                  {t("pos.notificationsMenu.emptyTitle")}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {t("pos.notificationsMenu.emptyHint")}
                </div>
              </div>
            ) : null}

            {loadState === "success" && items.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {items.map((notification) => {
                  const unread = notification.readStatus === "unread";
                  const statusLabel = t(
                    READ_STATUS_LABEL_KEYS[notification.readStatus],
                  );
                  const sentAt = formatSentAt(
                    notification.sentAt ?? notification.createdAt,
                    locale,
                  );

                  return (
                    <article
                      className={cn(
                        "px-4 py-3 transition",
                        unread ? "bg-blue-50/45" : "bg-white",
                      )}
                      key={notification.id}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            unread ? "bg-red-500" : "bg-slate-300",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-slate-950">
                              {notification.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                              {getNoticeTypeLabel(notification.noticeType, t)}
                            </span>
                          </div>
                          <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-slate-500">
                            {notification.content}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-[11px] font-medium text-slate-400">
                              {[statusLabel, sentAt].filter(Boolean).join(" · ")}
                            </span>
                            {unread ? (
                              <button
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
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

          <div className="border-t border-slate-100 p-3">
            <Link
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800"
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
