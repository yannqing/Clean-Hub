"use client";

import {
  isApiHttpError,
  type TenantProductOverview,
  type TenantProductStatus,
  type TenantProductSummary,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import {
  Barcode,
  CalendarDays,
  Check,
  CircleCheck,
  Download,
  ListFilter,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import {
  getTenantProductDatasetQuery,
  getTenantProductOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;

type ProductStatusFilter = "all" | TenantProductStatus;
type ProductDateFilter =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_365_days"
  | "all";
type ProductSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "stock_desc"
  | "stock_asc";
type ProductColumnKey =
  | "product"
  | "category"
  | "sku"
  | "price"
  | "inventory"
  | "status"
  | "createdAt";

const PRODUCT_COLUMN_KEYS: ProductColumnKey[] = [
  "product",
  "category",
  "sku",
  "price",
  "inventory",
  "status",
  "createdAt",
];

const DEFAULT_VISIBLE_COLUMNS: Record<ProductColumnKey, boolean> = {
  product: true,
  category: true,
  sku: true,
  price: true,
  inventory: true,
  status: true,
  createdAt: true,
};

function buildDateRange(filter: ProductDateFilter): {
  createdAfter?: string;
  createdBefore?: string;
} {
  if (filter === "all") {
    return {};
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function toFiniteNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  }).format(toFiniteNumber(value));
}

function formatPriceRanges(
  product: TenantProductSummary,
  locale: string,
): string | null {
  if (product.priceRanges.length === 0) {
    return null;
  }

  return product.priceRanges
    .map((range) => {
      const minimum = toFiniteNumber(range.minAmount);
      const maximum = toFiniteNumber(range.maxAmount);
      const formattedMinimum = formatMoney(minimum, range.currency, locale);

      if (minimum === maximum) {
        return formattedMinimum;
      }

      return `${formattedMinimum} – ${formatMoney(
        maximum,
        range.currency,
        locale,
      )}`;
    })
    .join(" · ");
}

function getProductStatusVariant(
  status: TenantProductStatus,
): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

function isProductsFeatureDisabled(error: unknown): boolean {
  return isApiHttpError(error) && error.code === "FEATURE_DISABLED";
}

export function TenantProductsView() {
  const { formatDateTime, locale, m } = useTenantI18n();
  const [productDataset, setProductDataset] = useState<TenantProductSummary[]>(
    [],
  );
  const [overview, setOverview] = useState<TenantProductOverview | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProductStatusFilter>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<ProductDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<ProductSort>("created_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const { createdAfter, createdBefore } = buildDateRange(dateFilter);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantProductDatasetQuery(
      {
        createdAfter,
        createdBefore,
        status: status === "all" ? undefined : status,
      },
      controller.signal,
    )
      .then((result) => {
        if (!current) {
          return;
        }

        setProductDataset(result);
        setListError(null);
        setFeatureDisabled(false);
      })
      .catch((error: unknown) => {
        if (!current) {
          return;
        }

        if (isProductsFeatureDisabled(error)) {
          setFeatureDisabled(true);
          setListError(null);
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setListError(m.products.loadError);
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
    m.products.loadError,
    refreshVersion,
    status,
  ]);

  useEffect(() => {
    let current = true;

    getTenantProductOverviewQuery({
      createdAfter,
      createdBefore,
    })
      .then((result) => {
        if (!current) {
          return;
        }

        setOverview(result);
        setOverviewError(null);
      })
      .catch((error: unknown) => {
        if (current && isProductsFeatureDisabled(error)) {
          setFeatureDisabled(true);
          setOverviewError(null);
        } else if (current) {
          setOverviewError(m.products.overviewError);
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
  }, [createdAfter, createdBefore, m.products.overviewError, refreshVersion]);

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase(locale);
  const filteredAndSortedProducts = useMemo(() => {
    const matchingProducts = normalizedSearchQuery
      ? productDataset.filter((product) => {
          const searchableValues = [
            product.name,
            product.brand,
            product.categoryName,
            ...product.skuCodes,
            ...product.barcodes,
          ];

          return searchableValues.some((value) =>
            value?.toLocaleLowerCase(locale).includes(normalizedSearchQuery),
          );
        })
      : productDataset;
    const collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
    });

    return [...matchingProducts].sort((left, right) => {
      if (sort === "created_desc" || sort === "created_asc") {
        const difference =
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime();

        return sort === "created_asc" ? difference : -difference;
      }

      if (sort === "name_asc" || sort === "name_desc") {
        const difference = collator.compare(left.name, right.name);
        return sort === "name_asc" ? difference : -difference;
      }

      const difference =
        toFiniteNumber(left.onHandQuantity) -
        toFiniteNumber(right.onHandQuantity);
      return sort === "stock_asc" ? difference : -difference;
    });
  }, [locale, normalizedSearchQuery, productDataset, sort]);
  const total = filteredAndSortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const products = useMemo(
    () =>
      filteredAndSortedProducts.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredAndSortedProducts],
  );
  const visibleColumnCount =
    Object.values(visibleColumns).filter(Boolean).length;
  const sortOptions: Array<{ label: string; value: ProductSort }> = [
    {
      label: m.products.toolbar.sortOptions.createdDesc,
      value: "created_desc",
    },
    {
      label: m.products.toolbar.sortOptions.createdAsc,
      value: "created_asc",
    },
    {
      label: m.products.toolbar.sortOptions.nameAsc,
      value: "name_asc",
    },
    {
      label: m.products.toolbar.sortOptions.nameDesc,
      value: "name_desc",
    },
    {
      label: m.products.toolbar.sortOptions.stockDesc,
      value: "stock_desc",
    },
    {
      label: m.products.toolbar.sortOptions.stockAsc,
      value: "stock_asc",
    },
  ];
  const statusOptions: Array<{
    label: string;
    value: ProductStatusFilter;
  }> = [
    { label: m.products.toolbar.allStatusesOption, value: "all" },
    { label: m.products.statusLabels.active, value: "active" },
    { label: m.products.statusLabels.inactive, value: "inactive" },
  ];
  const selectedStatusLabel =
    statusOptions.find((option) => option.value === status)?.label ??
    m.products.toolbar.allStatusesOption;
  const dateOptions: Array<{ label: string; value: ProductDateFilter }> = [
    { label: m.products.toolbar.dateOptions.today, value: "today" },
    {
      label: m.products.toolbar.dateOptions.last7Days,
      value: "last_7_days",
    },
    {
      label: m.products.toolbar.dateOptions.last30Days,
      value: "last_30_days",
    },
    {
      label: m.products.toolbar.dateOptions.last365Days,
      value: "last_365_days",
    },
    { label: m.products.toolbar.dateOptions.all, value: "all" },
  ];
  const selectedDateLabel =
    dateOptions.find((option) => option.value === dateFilter)?.label ??
    m.products.toolbar.dateOptions.all;
  const metrics = useMemo(
    () => [
      {
        icon: Package,
        label: m.products.metrics.totalProducts,
        value: overview?.productCount.toLocaleString(locale) ?? "—",
      },
      {
        icon: CircleCheck,
        label: m.products.metrics.activeProducts,
        value: overview?.activeProductCount.toLocaleString(locale) ?? "—",
      },
      {
        icon: Barcode,
        label: m.products.metrics.totalSkus,
        value: overview?.skuCount.toLocaleString(locale) ?? "—",
      },
      {
        icon: TriangleAlert,
        label: m.products.metrics.lowStockSkus,
        value: overview?.lowStockSkuCount.toLocaleString(locale) ?? "—",
      },
    ],
    [locale, m.products.metrics, overview],
  );
  const hasActiveFilters =
    status !== "all" ||
    dateFilter !== "all" ||
    normalizedSearchQuery.length > 0;

  function refresh() {
    setListLoading(true);
    setOverviewLoading(true);
    setListError(null);
    setOverviewError(null);
    setFeatureDisabled(false);
    setPage(1);
    setRefreshVersion((current) => current + 1);
  }

  function beginFilteredRequest() {
    setListLoading(true);
    setListError(null);
    setPage(1);
  }

  function changeStatus(nextStatus: ProductStatusFilter) {
    if (nextStatus === status) {
      return;
    }

    beginFilteredRequest();
    setStatus(nextStatus);
  }

  function changeDateFilter(nextFilter: ProductDateFilter) {
    if (nextFilter === dateFilter) {
      return;
    }

    beginFilteredRequest();
    setOverviewLoading(true);
    setOverviewError(null);
    setDateFilter(nextFilter);
  }

  function changeSearchQuery(nextQuery: string) {
    setSearchQuery(nextQuery);
    setPage(1);
  }

  function changeSort(nextSort: ProductSort) {
    setSort(nextSort);
    setPage(1);
  }

  function setColumnVisible(column: ProductColumnKey, checked: boolean) {
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
    <section className="space-y-7 pb-8" data-testid="tenant-products-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={Package} size={19} />
          <span>{m.products.title}</span>
        </h1>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            data-testid="tenant-products-import"
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={Upload} size={14} />
            <span>{m.products.toolbar.importAction}</span>
          </Button>

          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            data-testid="tenant-products-export"
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={Download} size={14} />
            <span>{m.products.toolbar.exportAction}</span>
          </Button>

          <Popover onOpenChange={setDateMenuOpen} open={dateMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                aria-label={`${m.products.toolbar.dateLabel}: ${selectedDateLabel}`}
                className="h-8 gap-1.5 px-2.5 text-xs"
                size="sm"
                title={`${m.products.toolbar.dateLabel}: ${selectedDateLabel}`}
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
                        dateFilter === option.value
                          ? "opacity-100"
                          : "opacity-0",
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

          <Button
            asChild
            className="h-8 gap-1.5 px-2.5 text-xs"
            data-testid="tenant-products-add"
            size="sm"
          >
            <Link href={webAdminRoutes.tenant.newProduct}>
              <Icon aria-hidden icon={Plus} size={14} />
              <span>{m.products.toolbar.addProductAction}</span>
            </Link>
          </Button>
        </div>
      </header>

      {featureDisabled ? (
        <section className="border-y border-dashed bg-background px-4 py-14 text-center">
          <h2 className="text-base font-semibold">
            {m.products.featureDisabledTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.products.featureDisabledDescription}
          </p>
        </section>
      ) : (
        <>
          <section
            aria-label={m.products.metrics.label}
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
                      aria-label={`${m.products.toolbar.statusLabel}: ${selectedStatusLabel}`}
                      className={cn(status !== "all" && "bg-accent")}
                      size="icon-sm"
                      title={`${m.products.toolbar.statusLabel}: ${selectedStatusLabel}`}
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
                              status === option.value
                                ? "opacity-100"
                                : "opacity-0",
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
                  <label className="sr-only" htmlFor="tenant-product-search">
                    {m.products.toolbar.searchLabel}
                  </label>
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    icon={Search}
                    size={14}
                  />
                  <Input
                    className="h-8 pl-8 text-xs"
                    id="tenant-product-search"
                    inputMode="search"
                    onChange={(event) => changeSearchQuery(event.target.value)}
                    placeholder={m.products.toolbar.searchPlaceholder}
                    type="text"
                    value={searchQuery}
                  />
                </div>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    aria-label={m.products.toolbar.settingsLabel}
                    size="icon-sm"
                    title={m.products.toolbar.settingsLabel}
                    type="button"
                    variant="outline"
                  >
                    <Icon aria-hidden icon={SlidersHorizontal} size={15} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div>
                    <p className="px-1 text-xs font-semibold">
                      {m.products.toolbar.sortTitle}
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
                              sort === option.value
                                ? "opacity-100"
                                : "opacity-0",
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
                      {m.products.toolbar.columnsTitle}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                      {PRODUCT_COLUMN_KEYS.map((column) => {
                        const isLastVisible =
                          visibleColumns[column] && visibleColumnCount === 1;

                        return (
                          <label
                            className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                            htmlFor={`tenant-product-column-${column}`}
                            key={column}
                          >
                            <Checkbox
                              checked={visibleColumns[column]}
                              disabled={isLastVisible}
                              id={`tenant-product-column-${column}`}
                              onCheckedChange={(checked) =>
                                setColumnVisible(column, checked === true)
                              }
                            />
                            <span className="truncate">
                              {m.products.columns[column]}
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
            ) : products.length === 0 ? (
              <div className="p-4">
                <div className="border-y border-dashed px-4 py-14 text-center">
                  <h2 className="text-base font-semibold">
                    {hasActiveFilters
                      ? m.products.filteredEmptyTitle
                      : m.products.emptyTitle}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? m.products.filteredEmptyDescription
                      : m.products.emptyDescription}
                  </p>
                </div>
              </div>
            ) : (
              <Table
                className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5"
                style={{
                  minWidth: `${Math.max(520, visibleColumnCount * 112)}px`,
                }}
              >
                <TableHeader>
                  <TableRow>
                    {visibleColumns.product ? (
                      <TableHead>{m.products.columns.product}</TableHead>
                    ) : null}
                    {visibleColumns.category ? (
                      <TableHead>{m.products.columns.category}</TableHead>
                    ) : null}
                    {visibleColumns.sku ? (
                      <TableHead>{m.products.columns.sku}</TableHead>
                    ) : null}
                    {visibleColumns.price ? (
                      <TableHead>{m.products.columns.price}</TableHead>
                    ) : null}
                    {visibleColumns.inventory ? (
                      <TableHead>{m.products.columns.inventory}</TableHead>
                    ) : null}
                    {visibleColumns.status ? (
                      <TableHead>{m.products.columns.status}</TableHead>
                    ) : null}
                    {visibleColumns.createdAt ? (
                      <TableHead>{m.products.columns.createdAt}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const price = formatPriceRanges(product, locale);

                    return (
                      <TableRow key={product.id}>
                        {visibleColumns.product ? (
                          <TableCell>
                            <span className="block font-medium">
                              {product.name}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {product.brand || m.products.noBrand}
                            </span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.category ? (
                          <TableCell>
                            {product.categoryName || m.products.noCategory}
                          </TableCell>
                        ) : null}
                        {visibleColumns.sku ? (
                          <TableCell>
                            <span className="block font-medium">
                              {product.primarySkuCode || m.products.noSku}
                            </span>
                            {product.skuCount > 0 ? (
                              <>
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                  {product.primaryBarcode ||
                                    m.products.noBarcode}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                  {interpolate(m.products.skuCount, {
                                    count:
                                      product.skuCount.toLocaleString(locale),
                                  })}
                                </span>
                              </>
                            ) : null}
                          </TableCell>
                        ) : null}
                        {visibleColumns.price ? (
                          <TableCell>
                            <span
                              className={cn(!price && "text-muted-foreground")}
                            >
                              {price || m.products.noPrice}
                            </span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.inventory ? (
                          <TableCell>
                            {product.trackedSkuCount === 0 ? (
                              <span className="text-muted-foreground">
                                {m.products.inventoryNotTracked}
                              </span>
                            ) : (
                              <>
                                <span className="block font-medium">
                                  {interpolate(m.products.stockOnHand, {
                                    count: formatQuantity(
                                      product.onHandQuantity,
                                      locale,
                                    ),
                                  })}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                  {interpolate(m.products.stockReserved, {
                                    count: formatQuantity(
                                      product.reservedQuantity,
                                      locale,
                                    ),
                                  })}
                                </span>
                                {product.lowStockSkuCount > 0 ? (
                                  <span className="mt-0.5 block text-[10px] text-destructive">
                                    {interpolate(m.products.lowStock, {
                                      count:
                                        product.lowStockSkuCount.toLocaleString(
                                          locale,
                                        ),
                                    })}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </TableCell>
                        ) : null}
                        {visibleColumns.status ? (
                          <TableCell>
                            <Badge
                              className="px-1.5 py-px text-[11px]"
                              variant={getProductStatusVariant(product.status)}
                            >
                              {m.products.statusLabels[product.status]}
                            </Badge>
                          </TableCell>
                        ) : null}
                        {visibleColumns.createdAt ? (
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatDateTime(product.createdAt)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                {interpolate(m.products.pageSummary, {
                  page: currentPage.toLocaleString(locale),
                  pages: totalPages.toLocaleString(locale),
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  className="h-7 px-2 text-xs"
                  disabled={currentPage <= 1 || listLoading}
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {m.common.previous}
                </Button>
                <Button
                  className="h-7 px-2 text-xs"
                  disabled={currentPage >= totalPages || listLoading}
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {m.common.next}
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
