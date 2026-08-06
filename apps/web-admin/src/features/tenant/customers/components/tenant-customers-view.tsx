"use client";

import type {
  TenantCustomerOverview,
  TenantCustomerSort,
  TenantCustomerStatus,
  TenantCustomerSummary,
} from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import { DataTable, DataTableMetricCards, DataTablePagePagination, DataTableSurface, DataTableToolbar } from "@cleanhub/ui/data-table";
import {
  CalendarDays,
  Check,
  ContactRound,
  Link2,
  ListFilter,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  getTenantCustomerListQuery,
  getTenantCustomerOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;

type CustomerStatusFilter = "all" | TenantCustomerStatus;
type CustomerDateFilter =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_365_days"
  | "all";
type CustomerColumnKey =
  | "customer"
  | "account"
  | "phone"
  | "email"
  | "status"
  | "createdAt";

const CUSTOMER_COLUMN_KEYS: CustomerColumnKey[] = [
  "customer",
  "account",
  "phone",
  "email",
  "status",
  "createdAt",
];

const DEFAULT_VISIBLE_COLUMNS: Record<CustomerColumnKey, boolean> = {
  customer: true,
  account: true,
  phone: true,
  email: true,
  status: true,
  createdAt: true,
};

function buildDateRange(filter: CustomerDateFilter): {
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

function getCustomerStatusVariant(
  status: TenantCustomerStatus,
): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

export function TenantCustomersView({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const [customers, setCustomers] = useState<TenantCustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<TenantCustomerOverview | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CustomerStatusFilter>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<CustomerDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    initialSearchQuery.trim(),
  );
  const [sort, setSort] = useState<TenantCustomerSort>("created_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const { createdAfter, createdBefore } = buildDateRange(dateFilter);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantCustomerListQuery(
      {
        createdAfter,
        createdBefore,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        q: debouncedSearchQuery || undefined,
        sort,
        status: status === "all" ? undefined : status,
      },
      { signal: controller.signal },
    )
      .then((result) => {
        if (!current) {
          return;
        }

        const resultTotalPages = Math.max(
          1,
          Math.ceil(result.total / PAGE_SIZE),
        );
        if (page > resultTotalPages) {
          setPage(resultTotalPages);
          return;
        }

        setCustomers(result.data);
        setTotal(result.total);
        setListError(null);
      })
      .catch(() => {
        if (current) {
          setListError(m.customers.loadError);
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
    debouncedSearchQuery,
    m.customers.loadError,
    page,
    refreshVersion,
    sort,
    status,
  ]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantCustomerOverviewQuery(
      { createdAfter, createdBefore },
      { signal: controller.signal },
    )
      .then((result) => {
        if (!current) return;
        setOverview(result);
        setOverviewError(null);
      })
      .catch(() => {
        if (current) setOverviewError(m.customers.loadError);
      })
      .finally(() => {
        if (current) setOverviewLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [
    createdAfter,
    createdBefore,
    m.customers.loadError,
    refreshVersion,
  ]);

  const metrics = useMemo(() => {
    return [
      {
        icon: UserRound,
        label: m.customers.metrics.totalCustomers,
        value: overview?.totalCustomers.toLocaleString(locale) ?? "—",
      },
      {
        icon: UserCheck,
        label: m.customers.metrics.activeCustomers,
        value: overview?.activeCustomers.toLocaleString(locale) ?? "—",
      },
      {
        icon: UserX,
        label: m.customers.metrics.disabledCustomers,
        value: overview?.disabledCustomers.toLocaleString(locale) ?? "—",
      },
      {
        icon: Link2,
        label: m.customers.metrics.linkedAccounts,
        value: overview?.linkedAccounts.toLocaleString(locale) ?? "—",
      },
    ];
  }, [locale, m.customers.metrics, overview]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page;
  const visibleColumnCount =
    Object.values(visibleColumns).filter(Boolean).length;

  const statusOptions: Array<{
    label: string;
    value: CustomerStatusFilter;
  }> = [
    { label: m.customers.toolbar.allStatusesOption, value: "all" },
    { label: m.customers.statusLabels.active, value: "active" },
    { label: m.customers.statusLabels.disabled, value: "disabled" },
  ];
  const selectedStatusLabel =
    statusOptions.find((option) => option.value === status)?.label ??
    m.customers.toolbar.allStatusesOption;
  const dateOptions: Array<{ label: string; value: CustomerDateFilter }> = [
    { label: m.customers.toolbar.dateOptions.today, value: "today" },
    {
      label: m.customers.toolbar.dateOptions.last7Days,
      value: "last_7_days",
    },
    {
      label: m.customers.toolbar.dateOptions.last30Days,
      value: "last_30_days",
    },
    {
      label: m.customers.toolbar.dateOptions.last365Days,
      value: "last_365_days",
    },
    { label: m.customers.toolbar.dateOptions.all, value: "all" },
  ];
  const selectedDateLabel =
    dateOptions.find((option) => option.value === dateFilter)?.label ??
    m.customers.toolbar.dateOptions.all;
  const sortOptions: Array<{ label: string; value: TenantCustomerSort }> = [
    {
      label: m.customers.toolbar.sortOptions.createdDesc,
      value: "created_desc",
    },
    {
      label: m.customers.toolbar.sortOptions.createdAsc,
      value: "created_asc",
    },
    {
      label: m.customers.toolbar.sortOptions.nameAsc,
      value: "name_asc",
    },
    {
      label: m.customers.toolbar.sortOptions.nameDesc,
      value: "name_desc",
    },
  ];

  function refresh() {
    setListLoading(true);
    setOverviewLoading(true);
    setListError(null);
    setOverviewError(null);
    setPage(1);
    setRefreshVersion((current) => current + 1);
  }

  function beginFilteredRequest() {
    setListLoading(true);
    setListError(null);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    setListLoading(true);
    setListError(null);
    setPage(nextPage);
  }

  function changeStatus(nextStatus: CustomerStatusFilter) {
    if (nextStatus === status) return;
    beginFilteredRequest();
    setStatus(nextStatus);
  }

  function changeDateFilter(nextFilter: CustomerDateFilter) {
    if (nextFilter === dateFilter) return;
    beginFilteredRequest();
    setOverviewLoading(true);
    setOverviewError(null);
    setDateFilter(nextFilter);
  }

  function changeSearchQuery(nextQuery: string) {
    setListLoading(true);
    setListError(null);
    setSearchQuery(nextQuery);
    setPage(1);
  }

  function changeSort(nextSort: TenantCustomerSort) {
    if (nextSort === sort) return;
    beginFilteredRequest();
    setSort(nextSort);
  }

  function setColumnVisible(column: CustomerColumnKey, checked: boolean) {
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

  const hasActiveFilters =
    dateFilter !== "all" ||
    status !== "all" ||
    debouncedSearchQuery.length > 0;

  return (
    <section className="space-y-7 pb-8" data-testid="tenant-customers-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={ContactRound} size={19} />
          <span>{m.customers.title}</span>
        </h1>

        <Popover onOpenChange={setDateMenuOpen} open={dateMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label={`${m.customers.toolbar.dateLabel}: ${selectedDateLabel}`}
              className="h-8 gap-1.5 px-2.5 text-xs"
              size="sm"
              title={`${m.customers.toolbar.dateLabel}: ${selectedDateLabel}`}
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

      <DataTableMetricCards
        ariaLabel={m.customers.metrics.label}
        loading={overviewLoading}
        metrics={metrics}
      />

      {overviewError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {overviewError}
        </div>
      ) : null}

      <DataTableSurface>
        <DataTableToolbar>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Popover onOpenChange={setStatusMenuOpen} open={statusMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label={`${m.customers.toolbar.statusLabel}: ${selectedStatusLabel}`}
                  className={cn(status !== "all" && "bg-accent")}
                  size="icon-sm"
                  title={`${m.customers.toolbar.statusLabel}: ${selectedStatusLabel}`}
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
              <label className="sr-only" htmlFor="tenant-customer-search">
                {m.customers.toolbar.searchLabel}
              </label>
              <Icon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                className="h-8 pl-8 text-xs"
                id="tenant-customer-search"
                inputMode="search"
                onChange={(event) => changeSearchQuery(event.target.value)}
                placeholder={m.customers.toolbar.searchPlaceholder}
                type="text"
                value={searchQuery}
              />
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={m.customers.toolbar.settingsLabel}
                size="icon-sm"
                title={m.customers.toolbar.settingsLabel}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div>
                <p className="px-1 text-xs font-semibold">
                  {m.customers.toolbar.sortTitle}
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
                  {m.customers.toolbar.columnsTitle}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {CUSTOMER_COLUMN_KEYS.map((column) => {
                    const isLastVisible =
                      visibleColumns[column] && visibleColumnCount === 1;

                    return (
                      <label
                        className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                        htmlFor={`tenant-customer-column-${column}`}
                        key={column}
                      >
                        <Checkbox
                          checked={visibleColumns[column]}
                          disabled={isLastVisible}
                          id={`tenant-customer-column-${column}`}
                          onCheckedChange={(checked) =>
                            setColumnVisible(column, checked === true)
                          }
                        />
                        <span className="truncate">
                          {m.customers.columns[column]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </DataTableToolbar>

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
        ) : customers.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h2 className="text-base font-semibold">
                {hasActiveFilters
                  ? m.customers.filteredEmptyTitle
                  : m.customers.emptyTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? m.customers.filteredEmptyDescription
                  : m.customers.emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <DataTable
            className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5"
            style={{
              minWidth: `${Math.max(520, visibleColumnCount * 118)}px`,
            }}
          >
            <TableHeader>
              <TableRow>
                {visibleColumns.customer ? (
                  <TableHead>{m.customers.columns.customer}</TableHead>
                ) : null}
                {visibleColumns.account ? (
                  <TableHead>{m.customers.columns.account}</TableHead>
                ) : null}
                {visibleColumns.phone ? (
                  <TableHead>{m.customers.columns.phone}</TableHead>
                ) : null}
                {visibleColumns.email ? (
                  <TableHead>{m.customers.columns.email}</TableHead>
                ) : null}
                {visibleColumns.status ? (
                  <TableHead>{m.customers.columns.status}</TableHead>
                ) : null}
                {visibleColumns.createdAt ? (
                  <TableHead>{m.customers.columns.createdAt}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  aria-label={interpolate(
                    m.customers.detail.openCustomer,
                    { customer: customer.fullName },
                  )}
                  className="cursor-pointer transition-colors focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  key={customer.id}
                  onClick={() =>
                    router.push(webAdminRoutes.tenant.customer(customer.id))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(webAdminRoutes.tenant.customer(customer.id));
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  {visibleColumns.customer ? (
                    <TableCell className="font-medium">
                      {customer.fullName}
                    </TableCell>
                  ) : null}
                  {visibleColumns.account ? (
                    <TableCell>{customer.accountName}</TableCell>
                  ) : null}
                  {visibleColumns.phone ? (
                    <TableCell>
                      {customer.phone || m.customers.notProvided}
                    </TableCell>
                  ) : null}
                  {visibleColumns.email ? (
                    <TableCell>
                      {customer.email || m.customers.notProvided}
                    </TableCell>
                  ) : null}
                  {visibleColumns.status ? (
                    <TableCell>
                      <Badge
                        className="px-1.5 py-px text-[11px]"
                        variant={getCustomerStatusVariant(customer.status)}
                      >
                        {m.customers.statusLabels[customer.status]}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumns.createdAt ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(customer.createdAt)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}

        <DataTablePagePagination
          loading={listLoading}
          nextLabel={m.common.next}
          onPageChange={goToPage}
          page={currentPage}
          previousLabel={m.common.previous}
          summary={interpolate(m.customers.pageSummary, {
              page: currentPage.toLocaleString(locale),
              pages: totalPages.toLocaleString(locale),
            })}
          totalPages={totalPages}
        />
      </DataTableSurface>
    </section>
  );
}
