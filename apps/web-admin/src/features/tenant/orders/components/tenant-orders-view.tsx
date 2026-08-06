"use client";

import { formatPosOrderCode } from "@cleanhub/domain/order-codes";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  toast,
} from "@cleanhub/ui";
import { DataTable, DataTableMetricCards, DataTablePagePagination, DataTableSurface, DataTableToolbar } from "@cleanhub/ui/data-table";
import type {
  TenantOrderImportFailure,
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
  Download,
  FileDown,
  ListFilter,
  LoaderCircle,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import { importTenantOrdersAction } from "../actions";
import {
  downloadTenantOrderExport,
  downloadTenantOrderImportTemplate,
  parseTenantOrderImportCsv,
  type TenantOrderCsvParseError,
  type TenantOrderCsvParseResult,
} from "../order-csv";
import {
  getTenantOrderExportDatasetQuery,
  getTenantOrderListQuery,
  getTenantOrderOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;
const MAX_IMPORT_FILE_SIZE = 1024 * 1024;

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

export function TenantOrdersView({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const [orders, setOrders] = useState<TenantOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<TenantOrderOverview | null>(null);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatusFilter>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<OrderDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(
    initialSearchQuery.trim(),
  );
  const [sort, setSort] = useState<TenantOrderSort>("created_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importParseResult, setImportParseResult] =
    useState<TenantOrderCsvParseResult | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [importFailures, setImportFailures] = useState<
    TenantOrderImportFailure[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
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

    getTenantOrderListQuery(
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

        setOrders(result.data);
        setTotal(result.total);
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
    debouncedSearchQuery,
    m.orders.loadError,
    page,
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page;
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
    setListLoading(true);
    setListError(null);
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
    setListLoading(true);
    setListError(null);
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

  function resetImportDialog() {
    setImportFileName("");
    setImportParseResult(null);
    setImportFileError(null);
    setImportFailures([]);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }

  function changeImportDialogOpen(open: boolean) {
    if (importing) {
      return;
    }

    setImportDialogOpen(open);
    if (!open) {
      resetImportDialog();
    }
  }

  function formatImportParseError(error: TenantOrderCsvParseError): string {
    switch (error.code) {
      case "empty":
        return m.orders.transfer.parseErrors.empty;
      case "malformed":
        return m.orders.transfer.parseErrors.malformed;
      case "missing_headers":
        return interpolate(m.orders.transfer.parseErrors.missingHeaders, {
          fields: error.headers.join(", "),
        });
      case "missing_values":
        return interpolate(m.orders.transfer.parseErrors.missingValues, {
          fields: error.fields.join(", "),
          row: String(error.row),
        });
      case "invalid_value":
        return interpolate(m.orders.transfer.parseErrors.invalidValue, {
          field: error.field,
          row: String(error.row),
        });
      case "conflicting_order":
        return interpolate(m.orders.transfer.parseErrors.conflictingOrder, {
          order: error.orderKey,
          row: String(error.row),
        });
      case "too_many_rows":
        return interpolate(m.orders.transfer.parseErrors.tooManyRows, {
          limit: String(error.limit),
        });
      case "too_many_orders":
        return interpolate(m.orders.transfer.parseErrors.tooManyOrders, {
          limit: String(error.limit),
        });
    }
  }

  async function selectImportFile(file: File | undefined) {
    setImportFailures([]);
    setImportParseResult(null);
    setImportFileError(null);
    setImportFileName(file?.name ?? "");

    if (!file) {
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setImportFileError(m.orders.transfer.fileTooLarge);
      return;
    }

    try {
      setImportParseResult(parseTenantOrderImportCsv(await file.text()));
    } catch {
      setImportFileError(m.orders.transfer.importFailed);
    }
  }

  async function importOrders() {
    if (!importParseResult?.ok) {
      return;
    }

    setImporting(true);
    setImportFileError(null);
    setImportFailures([]);

    try {
      const result = await importTenantOrdersAction(importParseResult.data);
      if (!result.ok) {
        setImportFileError(result.message || m.orders.transfer.importFailed);
        toast.error(m.orders.transfer.importFailed);
        return;
      }

      setImportParseResult(null);
      setImportFailures(result.data.failures);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }

      if (result.data.imported > 0) {
        refresh();
      }

      if (result.data.failed > 0) {
        toast.error(
          interpolate(m.orders.transfer.importPartial, {
            failed: String(result.data.failed),
            imported: String(result.data.imported),
          }),
        );
      } else {
        toast.success(
          interpolate(m.orders.transfer.importSuccess, {
            count: String(result.data.imported),
          }),
        );
        setImportDialogOpen(false);
        resetImportDialog();
      }
    } catch {
      setImportFileError(m.orders.transfer.importFailed);
      toast.error(m.orders.transfer.importFailed);
    } finally {
      setImporting(false);
    }
  }

  async function exportOrders() {
    setExporting(true);

    try {
      const exportOrders = await getTenantOrderExportDatasetQuery({
        createdAfter,
        createdBefore,
        q: debouncedSearchQuery || undefined,
        sort,
        status: status === "all" ? undefined : status,
      });

      if (exportOrders.length === 0) {
        toast.error(m.orders.transfer.exportEmpty);
        return;
      }

      const columns = m.orders.transfer.columns;
      downloadTenantOrderExport(exportOrders, branchNames, {
        headers: [
          columns.orderNumber,
          columns.orderId,
          columns.customer,
          columns.customerId,
          columns.branch,
          columns.branchId,
          columns.type,
          columns.itemCount,
          columns.itemNames,
          columns.subtotal,
          columns.discount,
          columns.total,
          columns.currency,
          columns.paid,
          columns.paymentStatus,
          columns.orderStatus,
          columns.notes,
          columns.createdAt,
          columns.updatedAt,
        ],
        paymentStatusLabels: m.orders.paymentStatusLabels,
        statusLabels: m.orders.statusLabels,
        typeLabels: m.orders.typeLabels,
        unknownCustomer: m.orders.unknownCustomer,
      });
    } catch {
      toast.error(m.orders.transfer.exportFailed);
    } finally {
      setExporting(false);
    }
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

      <DataTableMetricCards
        ariaLabel={m.orders.metrics.label}
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

          <div className="flex shrink-0 items-center gap-2">
            <Button
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => setImportDialogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon aria-hidden icon={Upload} size={14} />
              <span className="hidden sm:inline">
                {m.orders.transfer.importAction}
              </span>
            </Button>
            <Button
              className="h-8 gap-1.5 px-2.5 text-xs"
              disabled={exporting}
              onClick={() => void exportOrders()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon
                aria-hidden
                className={cn(exporting && "animate-spin")}
                icon={exporting ? LoaderCircle : Download}
                size={14}
              />
              <span className="hidden sm:inline">
                {exporting
                  ? m.orders.transfer.exporting
                  : m.orders.transfer.exportAction}
              </span>
            </Button>

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
          <DataTable
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
              {orders.map((order) => {
                const orderCode = formatPosOrderCode(order.id);
                const orderHref = webAdminRoutes.tenant.order(order.id);

                return (
                  <TableRow
                    aria-label={interpolate(m.orders.detail.openOrder, {
                      order: orderCode,
                    })}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    key={order.id}
                    onClick={() => router.push(orderHref)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(orderHref);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    {visibleColumns.order ? (
                      <TableCell className="font-medium">{orderCode}</TableCell>
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
                        {
                          m.orders.typeLabels[
                            order.orderType as TenantOrderType
                          ]
                        }
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
                );
              })}
            </TableBody>
          </DataTable>
        )}

        <DataTablePagePagination
          loading={listLoading}
          nextLabel={m.common.next}
          onPageChange={goToPage}
          page={currentPage}
          previousLabel={m.common.previous}
          summary={interpolate(m.orders.pageSummary, {
              page: currentPage.toLocaleString(locale),
              pages: totalPages.toLocaleString(locale),
            })}
          totalPages={totalPages}
        />
      </DataTableSurface>

      <Dialog onOpenChange={changeImportDialogOpen} open={importDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{m.orders.transfer.importTitle}</DialogTitle>
            <DialogDescription>
              {m.orders.transfer.importDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <Button
              className="w-fit gap-1.5"
              onClick={downloadTenantOrderImportTemplate}
              size="sm"
              type="button"
              variant="outline"
            >
              <Icon aria-hidden icon={FileDown} size={15} />
              {m.orders.transfer.templateAction}
            </Button>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="order-import-csv">
                {m.orders.transfer.fileLabel}
              </label>
              <Input
                accept=".csv,text/csv"
                disabled={importing}
                id="order-import-csv"
                onChange={(event) =>
                  void selectImportFile(event.target.files?.[0])
                }
                ref={importFileInputRef}
                type="file"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {m.orders.transfer.fileHint}
              </p>
            </div>

            {importFileName && importParseResult?.ok ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
                <p className="font-medium">{importFileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {interpolate(m.orders.transfer.readySummary, {
                    orders: String(importParseResult.orderCount),
                    rows: String(importParseResult.rowCount),
                  })}
                </p>
              </div>
            ) : null}

            {importFileError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {importFileError}
              </div>
            ) : null}

            {importParseResult && !importParseResult.ok ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                <p className="font-medium">{m.orders.transfer.errorsTitle}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {importParseResult.errors.map((error, index) => (
                    <li key={`${error.code}-${index}`}>
                      {formatImportParseError(error)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {importFailures.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <p className="font-medium">{m.orders.transfer.failuresTitle}</p>
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs">
                  {importFailures.map((failure) => (
                    <li key={failure.importKey}>
                      <span className="font-medium">{failure.importKey}:</span>{" "}
                      {failure.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              disabled={importing}
              onClick={() => changeImportDialogOpen(false)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={!importParseResult?.ok || importing}
              onClick={() => void importOrders()}
              type="button"
            >
              {importing ? (
                <Icon
                  aria-hidden
                  className="animate-spin"
                  icon={LoaderCircle}
                  size={15}
                />
              ) : null}
              {importing
                ? m.orders.transfer.importing
                : m.orders.transfer.submitImport}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
