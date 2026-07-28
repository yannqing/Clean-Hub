"use client";

import type { TenantNotificationInboxItem } from "@cleanhub/api-client";
import {
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import {
  ArrowRight,
  Bell,
  Check,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useWebAdminLocale } from "@/i18n";

import {
  markAllTenantHeaderNotificationsReadAction,
  markTenantHeaderNotificationReadAction,
} from "../actions";
import {
  getTenantHeaderNotificationOverviewQuery,
  getTenantHeaderNotificationsQuery,
} from "../queries";
import type { TenantHeaderCopy } from "../types";

type LoadState = "idle" | "loading" | "success" | "error";

type TenantHeaderMessagesProps = {
  copy: TenantHeaderCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MESSAGE_LIMIT = 8;

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

export function TenantHeaderMessages({
  copy,
  open,
  onOpenChange,
}: TenantHeaderMessagesProps) {
  const { locale } = useWebAdminLocale();
  const abortRef = useRef<AbortController | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [items, setItems] = useState<TenantNotificationInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState("loading");

    try {
      const [list, overview] = await Promise.all([
        getTenantHeaderNotificationsQuery(
          { limit: MESSAGE_LIMIT },
          { signal: controller.signal },
        ),
        getTenantHeaderNotificationOverviewQuery({
          signal: controller.signal,
        }),
      ]);
      setItems(list.data);
      setUnreadCount(overview.unreadCount);
      setLoadState("success");
    } catch (error) {
      if (!isAbortError(error)) {
        setLoadState("error");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getTenantHeaderNotificationOverviewQuery({
      signal: controller.signal,
    })
      .then((overview) => setUnreadCount(overview.unreadCount))
      .catch(() => {
        // Keep the header usable when the inbox is temporarily unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) {
      void loadMessages();
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }

  async function markRead(notification: TenantNotificationInboxItem) {
    if (notification.readStatus !== "unread") {
      return;
    }

    setActionId(notification.id);
    try {
      const updated = await markTenantHeaderNotificationReadAction(
        notification.id,
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
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
      await markAllTenantHeaderNotificationsReadAction();
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.readStatus === "unread"
            ? { ...item, readStatus: "read", readAt: now }
            : item,
        ),
      );
      setUnreadCount(0);
    } catch {
      setLoadState("error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-label={
            unreadCount > 0
              ? `${copy.messagesLabel}, ${interpolate(
                  copy.messages.unreadCount,
                  { count: String(unreadCount) },
                )}`
              : copy.messagesLabel
          }
          className={cn(
            "relative flex size-9 items-center justify-center rounded-xl text-white/75 transition-colors",
            "hover:bg-white/10 hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            open && "bg-white/15 text-white",
          )}
          data-testid="tenant-header-messages"
          title={copy.messagesLabel}
          type="button"
        >
          <Icon aria-hidden icon={Bell} size={18} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-black">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(390px,calc(100vw-1rem))] overflow-hidden rounded-xl p-0 shadow-xl"
        sideOffset={10}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{copy.messages.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unreadCount > 0
                ? interpolate(copy.messages.unreadCount, {
                    count: String(unreadCount),
                  })
                : copy.messages.noUnread}
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
            disabled={unreadCount === 0 || actionId === "all"}
            onClick={() => void markAllRead()}
            type="button"
          >
            {actionId === "all"
              ? copy.messages.marking
              : copy.messages.markAllRead}
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loadState === "loading" || loadState === "idle" ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Icon
                aria-hidden
                className="animate-spin"
                icon={RefreshCw}
                size={15}
              />
              {copy.messages.loading}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold">{copy.messages.errorTitle}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.messages.errorHint}
              </p>
              <button
                className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition hover:bg-muted"
                onClick={() => void loadMessages()}
                type="button"
              >
                <Icon aria-hidden icon={RefreshCw} size={14} />
                {copy.messages.retry}
              </button>
            </div>
          ) : null}

          {loadState === "success" && items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon aria-hidden icon={Bell} size={18} />
              </span>
              <p className="mt-3 text-sm font-semibold">
                {copy.messages.emptyTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.messages.emptyHint}
              </p>
            </div>
          ) : null}

          {loadState === "success" && items.length > 0 ? (
            <div className="divide-y">
              {items.map((notification) => {
                const unread = notification.readStatus === "unread";
                const sentAt = formatSentAt(
                  notification.sentAt ?? notification.createdAt,
                  locale,
                );
                const typeLabel =
                  notification.noticeType === "business"
                    ? copy.messages.businessType
                    : copy.messages.systemType;
                const statusLabel = unread
                  ? copy.messages.unreadStatus
                  : copy.messages.readStatus;

                return (
                  <article
                    className={cn(
                      "px-4 py-3.5",
                      unread && "bg-muted/45",
                    )}
                    key={notification.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          unread ? "bg-red-500" : "bg-muted-foreground/30",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 text-sm font-semibold leading-5">
                            {notification.title}
                          </h3>
                          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
                            {typeLabel}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {notification.content}
                        </p>
                        <div className="mt-2 flex min-h-7 items-center justify-between gap-3">
                          <span className="truncate text-[11px] text-muted-foreground">
                            {[statusLabel, sentAt].filter(Boolean).join(" · ")}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {notification.relatedType === "order" ? (
                              <Link
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition hover:bg-background"
                                href={webAdminRoutes.tenant.orders}
                                onClick={() => {
                                  if (unread) {
                                    void markRead(notification);
                                  }
                                  onOpenChange(false);
                                }}
                              >
                                {copy.messages.relatedOrder}
                                <Icon
                                  aria-hidden
                                  icon={ArrowRight}
                                  size={12}
                                />
                              </Link>
                            ) : null}
                            {unread ? (
                              <button
                                aria-label={`${copy.messages.markRead}: ${notification.title}`}
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition hover:bg-background disabled:cursor-not-allowed disabled:text-muted-foreground"
                                disabled={actionId === notification.id}
                                onClick={() => void markRead(notification)}
                                type="button"
                              >
                                <Icon aria-hidden icon={Check} size={12} />
                                {actionId === notification.id
                                  ? copy.messages.marking
                                  : copy.messages.markRead}
                              </button>
                            ) : null}
                          </div>
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
            className="flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            href={webAdminRoutes.tenant.notifications}
            onClick={() => onOpenChange(false)}
          >
            {copy.messages.viewAll}
            <Icon aria-hidden className="ml-1.5" icon={ArrowRight} size={13} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
