"use client";

import type {
  TenantNotificationInboxItem,
  TenantNotificationInboxNoticeType,
  TenantNotificationInboxOverview,
  TenantNotificationInboxPriority,
  TenantNotificationInboxReadStatus,
} from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  toast,
} from "@cleanhub/ui";
import {
  Archive,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ListFilter,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  archiveTenantNotification,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
} from "../actions";
import {
  getTenantNotificationListQuery,
  getTenantNotificationOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;

type ReadStatusFilter = "all" | "unread" | "read";
type NoticeTypeFilter = "all" | TenantNotificationInboxNoticeType;
type PriorityFilter = "all" | TenantNotificationInboxPriority;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function TenantNotificationsView() {
  const { formatDateTime, m } = useTenantI18n();
  const copy = m.notificationCenter;
  const [items, setItems] = useState<TenantNotificationInboxItem[]>([]);
  const [overview, setOverview] =
    useState<TenantNotificationInboxOverview | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [readStatus, setReadStatus] = useState<ReadStatusFilter>("all");
  const [noticeType, setNoticeType] = useState<NoticeTypeFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    Promise.all([
      getTenantNotificationListQuery(
        {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          q: searchQuery || undefined,
          readStatus: readStatus === "all" ? undefined : readStatus,
          noticeType: noticeType === "all" ? undefined : noticeType,
          priority: priority === "all" ? undefined : priority,
        },
        { signal: controller.signal },
      ),
      getTenantNotificationOverviewQuery({ signal: controller.signal }),
    ])
      .then(([list, nextOverview]) => {
        if (!current) {
          return;
        }

        setItems(list.data);
        setTotal(list.total);
        setOverview(nextOverview);
      })
      .catch((error: unknown) => {
        if (current && !isAbortError(error)) {
          setLoadError(getErrorMessage(error, copy.loadError));
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false);
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [
    copy.loadError,
    noticeType,
    page,
    priority,
    readStatus,
    refreshVersion,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(page * PAGE_SIZE, total);

  const filterSummary = useMemo(() => {
    const values = [
      readStatus === "all" ? null : copy.toolbar[readStatus],
      noticeType === "all" ? null : copy.toolbar[noticeType],
      priority === "all" ? null : copy.toolbar[priority],
    ].filter(Boolean);

    return values.length > 0 ? values.join(" · ") : copy.toolbar.all;
  }, [copy.toolbar, noticeType, priority, readStatus]);

  function refresh() {
    setLoading(true);
    setLoadError(null);
    setRefreshVersion((current) => current + 1);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLoadError(null);
    setPage(1);
    setSearchQuery(searchInput.trim());
  }

  function clearSearch() {
    setLoading(true);
    setLoadError(null);
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  function updateReadStatus(value: ReadStatusFilter) {
    setLoading(true);
    setLoadError(null);
    setReadStatus(value);
    setPage(1);
    setFilterOpen(false);
  }

  function updateNoticeType(value: NoticeTypeFilter) {
    setLoading(true);
    setLoadError(null);
    setNoticeType(value);
    setPage(1);
    setFilterOpen(false);
  }

  function updatePriority(value: PriorityFilter) {
    setLoading(true);
    setLoadError(null);
    setPriority(value);
    setPage(1);
    setFilterOpen(false);
  }

  async function handleMarkRead(item: TenantNotificationInboxItem) {
    if (item.readStatus !== "unread") {
      return;
    }

    setActionId(item.id);
    try {
      await markTenantNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                readStatus: "read" as TenantNotificationInboxReadStatus,
                readAt: new Date().toISOString(),
              }
            : entry,
        ),
      );
      setOverview((current) =>
        current
          ? { ...current, unreadCount: Math.max(0, current.unreadCount - 1) }
          : current,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, copy.loadError));
    } finally {
      setActionId(null);
    }
  }

  async function handleArchive(item: TenantNotificationInboxItem) {
    setActionId(`archive:${item.id}`);
    try {
      await archiveTenantNotification(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      if (item.readStatus === "unread") {
        setOverview((current) =>
          current
            ? { ...current, unreadCount: Math.max(0, current.unreadCount - 1) }
            : current,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, copy.loadError));
    } finally {
      setActionId(null);
    }
  }

  async function handleMarkAllRead() {
    if (!overview?.unreadCount) {
      return;
    }

    setActionId("all");
    try {
      await markAllTenantNotificationsRead();
      setItems((current) =>
        current.map((item) =>
          item.readStatus === "unread"
            ? {
                ...item,
                readStatus: "read" as TenantNotificationInboxReadStatus,
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setOverview((current) => (current ? { ...current, unreadCount: 0 } : current));
    } catch (error) {
      toast.error(getErrorMessage(error, copy.loadError));
    } finally {
      setActionId(null);
    }
  }

  function renderFilterOption<T extends string>(
    value: T,
    current: T,
    label: string,
    onSelect: (value: T) => void,
  ) {
    return (
      <button
        aria-pressed={current === value}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
          current === value && "bg-accent",
        )}
        onClick={() => onSelect(value)}
        type="button"
      >
        <Icon
          aria-hidden
          className={cn(current === value ? "opacity-100" : "opacity-0")}
          icon={Check}
          size={14}
        />
        {label}
      </button>
    );
  }

  return (
    <section className="space-y-6 pb-8" data-testid="tenant-notifications-view">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon aria-hidden icon={Bell} size={19} />
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {copy.eyebrow}
            </p>
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={!overview?.unreadCount || actionId === "all"}
            onClick={() => void handleMarkAllRead()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={Check} size={14} />
            {actionId === "all" ? copy.toolbar.refresh : copy.table.markRead}
          </Button>
          <Button
            aria-label={copy.toolbar.refresh}
            className="size-8 p-0"
            disabled={loading}
            onClick={refresh}
            size="sm"
            title={copy.toolbar.refresh}
            type="button"
            variant="outline"
          >
            <Icon
              aria-hidden
              className={cn(loading && "animate-spin")}
              icon={RefreshCw}
              size={14}
            />
          </Button>
        </div>
      </header>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-background">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{copy.stats.total}</dt>
          <dd className="mt-1 text-lg font-semibold">{total}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{copy.stats.unread}</dt>
          <dd className="mt-1 text-lg font-semibold text-red-600">
            {overview?.unreadCount ?? "—"}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{copy.stats.urgent}</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
            {overview?.urgentUnreadCount ?? "—"}
            {overview?.urgentUnreadCount ? (
              <Icon aria-hidden className="text-amber-500" icon={CircleAlert} size={15} />
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form className="relative flex min-w-0 flex-1 gap-2" onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <label className="sr-only" htmlFor="tenant-notifications-search">
              {copy.toolbar.searchLabel}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={15}
            />
            <Input
              className="h-9 pl-9 text-sm"
              id="tenant-notifications-search"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.toolbar.searchPlaceholder}
              value={searchInput}
            />
          </div>
          <Button className="h-9 px-3 text-xs" size="sm" type="submit">
            <Icon aria-hidden icon={Search} size={14} />
          </Button>
          {searchQuery ? (
            <Button
              className="h-9 px-3 text-xs"
              onClick={clearSearch}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copy.toolbar.all}
            </Button>
          ) : null}
        </form>

        <Popover onOpenChange={setFilterOpen} open={filterOpen}>
          <PopoverTrigger asChild>
            <Button className="h-9 gap-2 px-3 text-xs" size="sm" variant="outline">
              <Icon aria-hidden icon={ListFilter} size={14} />
              {copy.toolbar.filters}
              <span className="max-w-44 truncate text-muted-foreground">
                {filterSummary}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="grid gap-3">
              <div>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.toolbar.readStatus}
                </p>
                {renderFilterOption("all", readStatus, copy.toolbar.all, updateReadStatus)}
                {renderFilterOption("unread", readStatus, copy.toolbar.unread, updateReadStatus)}
                {renderFilterOption("read", readStatus, copy.toolbar.read, updateReadStatus)}
              </div>
              <div>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.toolbar.noticeType}
                </p>
                {renderFilterOption("all", noticeType, copy.toolbar.all, updateNoticeType)}
                {renderFilterOption("business", noticeType, copy.toolbar.business, updateNoticeType)}
                {renderFilterOption("system", noticeType, copy.toolbar.system, updateNoticeType)}
              </div>
              <div>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.toolbar.priority}
                </p>
                {renderFilterOption("all", priority, copy.toolbar.all, updatePriority)}
                {renderFilterOption("low", priority, copy.toolbar.low, updatePriority)}
                {renderFilterOption("normal", priority, copy.toolbar.normal, updatePriority)}
                {renderFilterOption("high", priority, copy.toolbar.high, updatePriority)}
                {renderFilterOption("critical", priority, copy.toolbar.critical, updatePriority)}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {loadError ? (
        <div className="grid gap-3 rounded-lg border bg-background px-5 py-10 text-center">
          <p className="text-sm font-semibold">{loadError}</p>
          <Button className="mx-auto" onClick={refresh} size="sm" type="button" variant="outline">
            <Icon aria-hidden icon={RefreshCw} size={14} />
            {copy.retry}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 rounded-lg border bg-background p-5">
          <div className="h-12 animate-pulse rounded-md bg-muted" />
          <div className="h-12 animate-pulse rounded-md bg-muted" />
          <div className="h-12 animate-pulse rounded-md bg-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="grid gap-3 rounded-lg border bg-background px-5 py-16 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon aria-hidden icon={Bell} size={20} />
          </span>
          <p className="text-sm font-semibold">{copy.empty}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">{copy.table.notification}</TableHead>
                    <TableHead>{copy.table.type}</TableHead>
                    <TableHead>{copy.table.priority}</TableHead>
                    <TableHead>{copy.table.status}</TableHead>
                    <TableHead>{copy.table.time}</TableHead>
                    <TableHead className="text-right">{copy.table.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const unread = item.readStatus === "unread";
                    const actionBusy = actionId === item.id || actionId === `archive:${item.id}`;
                    const typeLabel =
                      item.noticeType === "business"
                        ? copy.toolbar.business
                        : copy.toolbar.system;
                    const priorityLabel = copy.toolbar[item.priority];
                    const statusLabel = copy.status[item.readStatus];

                    return (
                      <TableRow className={cn(unread && "bg-muted/35")} key={item.id}>
                        <TableCell className="align-top">
                          <div className="flex items-start gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                unread ? "bg-red-500" : "bg-muted-foreground/30",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="font-semibold">{item.title}</p>
                              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                                {item.content}
                              </p>
                              {item.relatedType === "order" ? (
                                <Link
                                  className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline"
                                  href={webAdminRoutes.tenant.orders}
                                  onClick={() => {
                                    if (unread) {
                                      void handleMarkRead(item);
                                    }
                                  }}
                                >
                                  {copy.table.openOrder}
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline">{typeLabel}</Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant={
                              item.priority === "critical" || item.priority === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {priorityLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {statusLabel}
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                          {formatDateTime(item.sentAt ?? item.createdAt)}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex justify-end gap-1">
                            {unread ? (
                              <Button
                                aria-label={`${copy.table.markRead}: ${item.title}`}
                                className="size-8 p-0"
                                disabled={actionBusy}
                                onClick={() => void handleMarkRead(item)}
                                size="sm"
                                title={copy.table.markRead}
                                type="button"
                                variant="ghost"
                              >
                                <Icon aria-hidden icon={Check} size={14} />
                              </Button>
                            ) : null}
                            <Button
                              aria-label={`${copy.table.archive}: ${item.title}`}
                              className="size-8 p-0"
                              disabled={actionBusy}
                              onClick={() => void handleArchive(item)}
                              size="sm"
                              title={copy.table.archive}
                              type="button"
                              variant="ghost"
                            >
                              <Icon aria-hidden icon={Archive} size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {interpolate(copy.pageSummary, {
                from: String(pageFrom),
                to: String(pageTo),
                total: String(total),
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={ChevronLeft} size={14} />
                {copy.previous}
              </Button>
              <span className="min-w-16 text-center">
                {page} / {totalPages}
              </span>
              <Button
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {copy.next}
                <Icon aria-hidden icon={ChevronRight} size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
