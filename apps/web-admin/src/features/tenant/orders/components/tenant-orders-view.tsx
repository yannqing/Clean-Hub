"use client";

import { formatPosOrderCode } from "@cleanhub/domain/order-codes";
import {
  Badge,
  Button,
  Checkbox,
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
} from "@cleanhub/ui";
import type {
  TenantOrderOverview,
  TenantOrderPaymentStatus,
  TenantOrderSort,
  TenantOrderStatus,
  TenantOrderSummary,
  TenantOrderType,
} from "@cleanhub/api-client";
import {
  Banknote,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  ListFilter,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  getTenantOrderDatasetQuery,
  getTenantOrderOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;

type OrderStatusFilter = "all" | TenantOrderStatus;
type OrderDateFilter =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_365_days"
  | "all";
type OrderColumnKey =
  | "order"
  | "customer"
  | "branch"
  | "type"
  | "items"
  | "amount"
  | "payment"
  | "status"
  | "createdAt";

const ORDER_COLUMN_KEYS: OrderColumnKey[] = [
  "order",
  "customer",
  "branch",
  "type",
  "items",
  "amount",
  "payment",
  "status",
  "createdAt",
];

const DEFAULT_VISIBLE_COLUMNS: Record<OrderColumnKey, boolean> = {
  order: true,
  customer: true,
  branch: true,
  type: true,
  items: true,
  amount: true,
  payment: true,
  status: true,
  createdAt: true,
};

function buildDateRange(filter: OrderDateFilter): {
  createdAfter?: string;
  createdBefore?: string;
} {
  if (filter === "all") {
    return {};
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayMs = 24 * 60 * 60 * 1000;

  if (filter === "today") {
    return {
      createdAfter: todayStart.toISOString(),
      createdBefore: new Date(todayStart.getTime() + dayMs).toISOString(),
    };
  }

  const days = {
    last_7_days: 7,
    last_30_days: 30,
    last_365_days: 365,
  }[filter];

  return {
    createdAfter: new Date(
      todayStart.getTime() - (days - 1) * dayMs,
    ).toISOString(),
  };
}

function formatOrderMoney(
  value: string,
  currency: string,
  locale: string,
): string {
  const amount = Number(value);
  return formatMoney(Number.isFinite(amount) ? amount : 0, currency, locale);
}

function getOrderStatusVariant(
  status: TenantOrderStatus,
): "default" | "secondary" | "outline" {
  if (status === "paid" || status === "delivered") {
    return "default";
  }

  return status === "cancelled" ? "outline" : "secondary";
}

function getPaymentStatusVariant(
  status: TenantOrderPaymentStatus,
): "default" | "secondary" | "outline" {
  if (status === "paid") {
    return "default";
  }

  return status === "partial" ? "secondary" : "outline";
}

export function TenantOrdersView() {
  const { formatDateTime, locale, m } = useTenantI18n();
  const [orderDataset, setOrderDataset] = useState<TenantOrderSummary[]>([]);
  const [overview, setOverview] = useState<TenantOrderOverview | null>(null);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatusFilter>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<OrderDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<TenantOrderSort>("created_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const { createdAfter, createdBefore } = buildDateRange(dateFilter);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantOrderDatasetQuery(
      {
        createdAfter,
        createdBefore,
        sort,
        status: status === "all" ? undefined : status,
      },
      controller.signal,
    )
      .then((result) => {
        if (!current) {
          return;
        }

        setOrderDataset(result);
        setListError(null);
      })
      .catch(() => {
        if (current) {
          setListError(m.orders.loadError);
        }
      })
      .finally(() => {
        if (current) {
          setListLoading(false);
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [
    createdAfter,
    createdBefore,
    m.orders.loadError,
    refreshVersion,
    sort,
    status,
  ]);

  useEffect(() => {
    let current = true;

    Promise.allSettled([
      getTenantOrderOverviewQuery({
        period: "all",
        createdAfter,
        createdBefore,
      }),
      getBranchListQuery(),
    ])
      .then(([overviewResult, branchesResult]) => {
        if (!current) {
          return;
        }

        if (overviewResult.status === "fulfilled") {
          setOverview(overviewResult.value);
          setOverviewError(null);
        } else {
          setOverviewError(m.orders.overviewError);
        }

        if (branchesResult.status === "fulfilled") {
          setBranchNames(
            Object.fromEntries(
              branchesResult.value.map((branch) => [branch.id, branch.name]),
            ),
          );
        }
      })
      .finally(() => {
        if (current) {
          setOverviewLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [createdAfter, createdBefore, m.orders.overviewError, refreshVersion]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!normalizedSearchQuery) {
      return orderDataset;
    }

    return orderDataset.filter((order) => {
      const searchableValues = [
        formatPosOrderCode(order.id),
        order.id,
        order.customerName,
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearchQuery),
      );
    });
  }, [normalizedSearchQuery, orderDataset]);
  const total = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const orders = useMemo(
    () =>
      filteredOrders.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredOrders],
  );
  const visibleColumnCount =
    Object.values(visibleColumns).filter(Boolean).length;
  const sortOptions: Array<{ label: string; value: TenantOrderSort }> = [
    {
      label: m.orders.toolbar.sortOptions.createdDesc,
      value: "created_desc",
    },
    {
      label: m.orders.toolbar.sortOptions.createdAsc,
      value: "created_asc",
    },
    {
      label: m.orders.toolbar.sortOptions.amountDesc,
      value: "amount_desc",
    },
    {
      label: m.orders.toolbar.sortOptions.amountAsc,
      value: "amount_asc",
    },
  ];
  const statusOptions: Array<{
    label: string;
    value: OrderStatusFilter;
  }> = [
    { label: m.orders.toolbar.allStatusesOption, value: "all" },
    { label: m.orders.statusLabels.draft, value: "draft" },
    { label: m.orders.statusLabels.received, value: "received" },
    { label: m.orders.statusLabels.paid, value: "paid" },
    { label: m.orders.statusLabels.delivered, value: "delivered" },
    { label: m.orders.statusLabels.cancelled, value: "cancelled" },
  ];
  const selectedStatusLabel =
    statusOptions.find((option) => option.value === status)?.label ??
    m.orders.toolbar.allStatusesOption;
  const dateOptions: Array<{ label: string; value: OrderDateFilter }> = [
    { label: m.orders.toolbar.dateOptions.today, value: "today" },
    {
      label: m.orders.toolbar.dateOptions.last7Days,
      value: "last_7_days",
    },
    {
      label: m.orders.toolbar.dateOptions.last30Days,
      value: "last_30_days",
    },
    {
      label: m.orders.toolbar.dateOptions.last365Days,
      value: "last_365_days",
    },
    { label: m.orders.toolbar.dateOptions.all, value: "all" },
  ];
  const selectedDateLabel =
    dateOptions.find((option) => option.value === dateFilter)?.label ??
    m.orders.toolbar.dateOptions.all;
  const metrics = useMemo(
    () => [
      {
        icon: ShoppingBag,
        label: m.orders.metrics.totalOrders,
        value: overview ? overview.orderCount.toLocaleString(locale) : "—",
      },
      {
        icon: CircleDollarSign,
        label: m.orders.metrics.totalAmount,
        value: overview
          ? formatOrderMoney(overview.totalAmount, overview.currency, locale)
          : "—",
      },
      {
        icon: Banknote,
        label: m.orders.metrics.paidAmount,
        value: overview
          ? formatOrderMoney(overview.paidAmount, overview.currency, locale)
          : "—",
      },
      {
        icon: Clock3,
        label: m.orders.metrics.pendingPayment,
        value: overview
          ? (overview.unpaidCount + overview.partialCount).toLocaleString(
              locale,
            )
          : "—",
      },
    ],
    [locale, m.orders.metrics, overview],
  );

  function refresh() {
    setListLoading(true);
    setOverviewLoading(true);
    setListError(null);
    setOverviewError(null);
    setPage(1);
    setRefreshVersion((current) => current + 1);
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
  }

  function beginFilteredRequest() {
    setListLoading(true);
    setListError(null);
    setPage(1);
  }

  function changeStatus(nextStatus: OrderStatusFilter) {
    if (nextStatus === status) {
      return;
    }

    beginFilteredRequest();
    setStatus(nextStatus);
  }

  function changeSearchQuery(nextQuery: string) {
    setSearchQuery(nextQuery);
    setPage(1);
  }

  function changeSort(nextSort: TenantOrderSort) {
    if (nextSort === sort) {
      return;
    }

    beginFilteredRequest();
    setSort(nextSort);
  }

  function changeDateFilter(nextFilter: OrderDateFilter) {
    if (nextFilter === dateFilter) {
      return;
    }

    beginFilteredRequest();
    setOverviewLoading(true);
    setOverviewError(null);
    setDateFilter(nextFilter);
  }

  function setColumnVisible(column: OrderColumnKey, checked: boolean) {
    setVisibleColumns((current) => {
      const visibleCount = Object.values(current).filter(Boolean).length;

      if (!checked && current[column] && visibleCount === 1) {
        return current;
      }

      return {
        ...current,
        [column]: checked,
      };
    });
  }

  return (
    <section className="space-y-7 pb-8" data-testid="tenant-orders-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={ShoppingBag} size={19} />
          <span>{m.orders.title}</span>
        </h1>

        <Popover onOpenChange={setDateMenuOpen} open={dateMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label={`${m.orders.toolbar.dateLabel}: ${selectedDateLabel}`}
              className="h-8 gap-1.5 px-2.5 text-xs"
              size="sm"
              title={`${m.orders.toolbar.dateLabel}: ${selectedDateLabel}`}
              type="button"
              variant="outline"
            >
              <Icon aria-hidden icon={CalendarDays} size={14} />
              <span>{selectedDateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1.5">
            <div className="grid gap-1">
              {dateOptions.map((option) => (
                <button
                  aria-pressed={dateFilter === option.value}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                    dateFilter === option.value && "bg-accent",
                  )}
                  key={option.value}
                  onClick={() => {
                    changeDateFilter(option.value);
                    setDateMenuOpen(false);
                  }}
                  type="button"
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      dateFilter === option.value ? "opacity-100" : "opacity-0",
                    )}
                    icon={Check}
                    size={14}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </header>

      <section
        aria-label={m.orders.metrics.label}
        className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <div
            className="flex min-h-20 items-center gap-2.5 rounded-md border bg-background px-3 py-2.5"
            key={metric.label}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon aria-hidden icon={metric.icon} size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {metric.label}
              </span>
              {overviewLoading ? (
                <span className="mt-1.5 block h-5 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <span className="mt-0.5 block truncate text-lg font-semibold">
                  {metric.value}
                </span>
              )}
            </span>
          </div>
        ))}
      </section>

      {overviewError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {overviewError}
        </div>
      ) : null}

      <section className="min-w-0 border-y bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Popover onOpenChange={setStatusMenuOpen} open={statusMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label={`${m.orders.toolbar.statusLabel}: ${selectedStatusLabel}`}
                  className={cn(status !== "all" && "bg-accent")}
                  size="icon-sm"
                  title={`${m.orders.toolbar.statusLabel}: ${selectedStatusLabel}`}
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden icon={ListFilter} size={15} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1.5">
                <div className="grid gap-1">
                  {statusOptions.map((option) => (
                    <button
                      aria-pressed={status === option.value}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                        status === option.value && "bg-accent",
                      )}
                      key={option.value}
                      onClick={() => {
                        changeStatus(option.value);
                        setStatusMenuOpen(false);
                      }}
                      type="button"
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          status === option.value ? "opacity-100" : "opacity-0",
                        )}
                        icon={Check}
                        size={14}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative w-full max-w-sm">
              <label className="sr-only" htmlFor="tenant-order-search">
                {m.orders.toolbar.searchLabel}
              </label>
              <Icon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                className="h-8 pl-8 text-xs"
                id="tenant-order-search"
                inputMode="search"
                onChange={(event) => changeSearchQuery(event.target.value)}
                placeholder={m.orders.toolbar.searchPlaceholder}
                type="text"
                value={searchQuery}
              />
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={m.orders.toolbar.settingsLabel}
                size="icon-sm"
                title={m.orders.toolbar.settingsLabel}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div>
                <p className="px-1 text-xs font-semibold">
                  {m.orders.toolbar.sortTitle}
                </p>
                <div className="mt-2 grid gap-1">
                  {sortOptions.map((option) => (
                    <button
                      aria-pressed={sort === option.value}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                        sort === option.value && "bg-accent",
                      )}
                      key={option.value}
                      onClick={() => changeSort(option.value)}
                      type="button"
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "text-foreground",
                          sort === option.value ? "opacity-100" : "opacity-0",
                        )}
                        icon={Check}
                        size={14}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 border-t pt-3">
                <p className="px-1 text-xs font-semibold">
                  {m.orders.toolbar.columnsTitle}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {ORDER_COLUMN_KEYS.map((column) => {
                    const isLastVisible =
                      visibleColumns[column] && visibleColumnCount === 1;

                    return (
                      <label
                        className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                        htmlFor={`tenant-order-column-${column}`}
                        key={column}
                      >
                        <Checkbox
                          checked={visibleColumns[column]}
                          disabled={isLastVisible}
                          id={`tenant-order-column-${column}`}
                          onCheckedChange={(checked) =>
                            setColumnVisible(column, checked === true)
                          }
                        />
                        <span className="truncate">
                          {m.orders.columns[column]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {listLoading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                className="h-9 animate-pulse rounded-md bg-muted"
                key={row}
              />
            ))}
          </div>
        ) : listError ? (
          <div className="p-4">
            <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{listError}</span>
              <Button
                onClick={refresh}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.common.retry}
              </Button>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h2 className="text-base font-semibold">{m.orders.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {m.orders.emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <Table
            className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5"
            style={{
              minWidth: `${Math.max(520, visibleColumnCount * 102)}px`,
            }}
          >
            <TableHeader>
              <TableRow>
                {visibleColumns.order ? (
                  <TableHead>{m.orders.columns.order}</TableHead>
                ) : null}
                {visibleColumns.customer ? (
                  <TableHead>{m.orders.columns.customer}</TableHead>
                ) : null}
                {visibleColumns.branch ? (
                  <TableHead>{m.orders.columns.branch}</TableHead>
                ) : null}
                {visibleColumns.type ? (
                  <TableHead>{m.orders.columns.type}</TableHead>
                ) : null}
                {visibleColumns.items ? (
                  <TableHead>{m.orders.columns.items}</TableHead>
                ) : null}
                {visibleColumns.amount ? (
                  <TableHead>{m.orders.columns.amount}</TableHead>
                ) : null}
                {visibleColumns.payment ? (
                  <TableHead>{m.orders.columns.payment}</TableHead>
                ) : null}
                {visibleColumns.status ? (
                  <TableHead>{m.orders.columns.status}</TableHead>
                ) : null}
                {visibleColumns.createdAt ? (
                  <TableHead>{m.orders.columns.createdAt}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  {visibleColumns.order ? (
                    <TableCell className="font-medium">
                      {formatPosOrderCode(order.id)}
                    </TableCell>
                  ) : null}
                  {visibleColumns.customer ? (
                    <TableCell>
                      {order.customerName || m.orders.unknownCustomer}
                    </TableCell>
                  ) : null}
                  {visibleColumns.branch ? (
                    <TableCell>
                      {branchNames[order.branchId] ??
                        interpolate(m.orders.branchFallback, {
                          id: order.branchId.slice(-8),
                        })}
                    </TableCell>
                  ) : null}
                  {visibleColumns.type ? (
                    <TableCell>
                      {m.orders.typeLabels[order.orderType as TenantOrderType]}
                    </TableCell>
                  ) : null}
                  {visibleColumns.items ? (
                    <TableCell>
                      {order.itemCount.toLocaleString(locale)}
                    </TableCell>
                  ) : null}
                  {visibleColumns.amount ? (
                    <TableCell>
                      <span className="block font-medium">
                        {formatOrderMoney(
                          order.totalAmount,
                          order.currency,
                          locale,
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {m.orders.paidAmount}{" "}
                        {formatOrderMoney(
                          order.paidAmount,
                          order.currency,
                          locale,
                        )}
                      </span>
                    </TableCell>
                  ) : null}
                  {visibleColumns.payment ? (
                    <TableCell>
                      <Badge
                        className="px-1.5 py-px text-[11px]"
                        variant={getPaymentStatusVariant(order.paymentStatus)}
                      >
                        {m.orders.paymentStatusLabels[order.paymentStatus]}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumns.status ? (
                    <TableCell>
                      <Badge
                        className="px-1.5 py-px text-[11px]"
                        variant={getOrderStatusVariant(order.status)}
                      >
                        {m.orders.statusLabels[order.status]}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumns.createdAt ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {interpolate(m.orders.pageSummary, {
              page: currentPage.toLocaleString(locale),
              pages: totalPages.toLocaleString(locale),
            })}
          </span>
          <div className="flex gap-2">
            <Button
              disabled={currentPage <= 1 || listLoading}
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              size="sm"
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs"
            >
              {m.common.previous}
            </Button>
            <Button
              disabled={currentPage >= totalPages || listLoading}
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              size="sm"
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs"
            >
              {m.common.next}
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
