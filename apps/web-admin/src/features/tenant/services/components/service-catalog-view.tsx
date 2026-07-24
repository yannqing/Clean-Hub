"use client";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  CalendarDays,
  Check,
  CircleCheck,
  CircleOff,
  ClipboardList,
  Ellipsis,
  Layers3,
  ListFilter,
  Package,
  Pencil,
  Plus,
  Power,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isVersionConflict } from "@/features/tenant/shared/version-conflict";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
  updateServiceStatusAction,
} from "../actions";
import { getServiceDatasetQuery } from "../queries";
import type {
  ServiceBusinessLine,
  ServiceFormValues,
  ServiceStatus,
  ServiceSummary,
} from "../types";

const PAGE_SIZE = 10;

type BusinessLineFilter = "all" | ServiceBusinessLine;
type StatusFilter = "all" | ServiceStatus;
type ServiceDateFilter =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_365_days"
  | "all";
type ServiceSort = "created_desc" | "created_asc" | "name_asc" | "name_desc";
type ServiceColumnKey =
  | "service"
  | "businessLine"
  | "pricing"
  | "status"
  | "createdAt";

const businessLineValues: ServiceBusinessLine[] = [
  "laundry",
  "car_wash",
  "retail",
  "delivery",
];

const SERVICE_COLUMN_KEYS: ServiceColumnKey[] = [
  "service",
  "businessLine",
  "pricing",
  "status",
  "createdAt",
];

const DEFAULT_VISIBLE_COLUMNS: Record<ServiceColumnKey, boolean> = {
  service: true,
  businessLine: true,
  pricing: true,
  status: true,
  createdAt: true,
};

const defaultFormValues: ServiceFormValues = {
  businessLine: "laundry",
  name: "",
  categoryId: "",
  pricingUnit: "per_item",
  status: "active",
  version: 0,
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(service: ServiceSummary): ServiceFormValues {
  return {
    businessLine: service.businessLine,
    name: service.name,
    categoryId: service.categoryId ?? "",
    pricingUnit: service.pricingUnit,
    status: service.status,
    version: service.version,
  };
}

function buildDateRange(filter: ServiceDateFilter): {
  createdAfter?: number;
  createdBefore?: number;
} {
  if (filter === "all") {
    return {};
  }

  const now = new Date();
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayMs = 24 * 60 * 60 * 1000;

  if (filter === "today") {
    return {
      createdAfter: todayStart,
      createdBefore: todayStart + dayMs,
    };
  }

  const days = {
    last_7_days: 7,
    last_30_days: 30,
    last_365_days: 365,
  }[filter];

  return {
    createdAfter: todayStart - (days - 1) * dayMs,
  };
}

function isServiceWithinDateRange(
  service: ServiceSummary,
  filter: ServiceDateFilter,
): boolean {
  const { createdAfter, createdBefore } = buildDateRange(filter);

  if (createdAfter === undefined) {
    return true;
  }

  const createdAt = Date.parse(service.createdAt);
  if (!Number.isFinite(createdAt) || createdAt < createdAfter) {
    return false;
  }

  return createdBefore === undefined || createdAt < createdBefore;
}

export function ServiceCatalogView() {
  const { formatDateTime, locale, m } = useTenantI18n();
  const [serviceDataset, setServiceDataset] = useState<ServiceSummary[]>([]);
  const [page, setPage] = useState(1);
  const [businessLine, setBusinessLine] = useState<BusinessLineFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<ServiceDateFilter>("all");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ServiceSort>("created_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<ServiceFormValues>(defaultFormValues);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [actionMenuServiceId, setActionMenuServiceId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const businessLineOptions = useMemo(
    () =>
      businessLineValues.map((value) => ({
        value,
        label: m.common.businessLineLabels[value],
      })),
    [m.common.businessLineLabels],
  );

  const loadServices = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const result = await getServiceDatasetQuery(signal);

        if (!signal?.aborted) {
          setServiceDataset(result);
        }
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(getErrorMessage(loadError, m.services.requestFailed));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [m.services.requestFailed],
  );

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getServiceDatasetQuery(controller.signal)
      .then((result) => {
        if (current) {
          setServiceDataset(result);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (current) {
          setError(getErrorMessage(loadError, m.services.requestFailed));
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
  }, [m.services.requestFailed]);

  const dateScopedServices = useMemo(
    () =>
      serviceDataset.filter((service) =>
        isServiceWithinDateRange(service, dateFilter),
      ),
    [dateFilter, serviceDataset],
  );

  const metrics = useMemo(() => {
    const activeServices = dateScopedServices.filter(
      (service) => service.status === "active",
    ).length;
    const inactiveServices = dateScopedServices.length - activeServices;
    const businessLines = new Set(
      dateScopedServices.map((service) => service.businessLine),
    ).size;

    return [
      {
        icon: Package,
        label: m.services.metrics.totalServices,
        value: dateScopedServices.length.toLocaleString(locale),
      },
      {
        icon: CircleCheck,
        label: m.services.metrics.activeServices,
        value: activeServices.toLocaleString(locale),
      },
      {
        icon: CircleOff,
        label: m.services.metrics.inactiveServices,
        value: inactiveServices.toLocaleString(locale),
      },
      {
        icon: Layers3,
        label: m.services.metrics.businessLines,
        value: businessLines.toLocaleString(locale),
      },
    ];
  }, [dateScopedServices, locale, m.services.metrics]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredServices = useMemo(() => {
    const matchingServices = dateScopedServices.filter((service) => {
      if (status !== "all" && service.status !== status) {
        return false;
      }

      if (businessLine !== "all" && service.businessLine !== businessLine) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableValues = [
        service.id,
        service.name,
        service.categoryId,
        m.common.businessLineLabels[service.businessLine],
        m.common.pricingUnitLabels[service.pricingUnit],
      ];

      return searchableValues.some((value) =>
        value?.toLowerCase().includes(normalizedQuery),
      );
    });

    return matchingServices.toSorted((left, right) => {
      if (sort === "created_desc") {
        return right.createdAt.localeCompare(left.createdAt);
      }

      if (sort === "created_asc") {
        return left.createdAt.localeCompare(right.createdAt);
      }

      const nameComparison = left.name.localeCompare(right.name, locale);
      return sort === "name_asc" ? nameComparison : -nameComparison;
    });
  }, [
    businessLine,
    dateScopedServices,
    locale,
    m.common.businessLineLabels,
    m.common.pricingUnitLabels,
    normalizedQuery,
    sort,
    status,
  ]);

  const total = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const services = useMemo(
    () =>
      filteredServices.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredServices],
  );
  const visibleColumnCount =
    Object.values(visibleColumns).filter(Boolean).length;

  const statusOptions: Array<{ label: string; value: StatusFilter }> = [
    { label: m.common.allStatuses, value: "all" },
    { label: m.common.statusLabels.active, value: "active" },
    { label: m.common.statusLabels.inactive, value: "inactive" },
  ];
  const dateOptions: Array<{ label: string; value: ServiceDateFilter }> = [
    { label: m.services.toolbar.dateOptions.today, value: "today" },
    {
      label: m.services.toolbar.dateOptions.last7Days,
      value: "last_7_days",
    },
    {
      label: m.services.toolbar.dateOptions.last30Days,
      value: "last_30_days",
    },
    {
      label: m.services.toolbar.dateOptions.last365Days,
      value: "last_365_days",
    },
    { label: m.services.toolbar.dateOptions.all, value: "all" },
  ];
  const selectedDateLabel =
    dateOptions.find((option) => option.value === dateFilter)?.label ??
    m.services.toolbar.dateOptions.all;
  const sortOptions: Array<{ label: string; value: ServiceSort }> = [
    {
      label: m.services.toolbar.sortOptions.createdDesc,
      value: "created_desc",
    },
    {
      label: m.services.toolbar.sortOptions.createdAsc,
      value: "created_asc",
    },
    {
      label: m.services.toolbar.sortOptions.nameAsc,
      value: "name_asc",
    },
    {
      label: m.services.toolbar.sortOptions.nameDesc,
      value: "name_desc",
    },
  ];
  const hasActiveFilters =
    dateFilter !== "all" ||
    status !== "all" ||
    businessLine !== "all" ||
    normalizedQuery.length > 0;

  function changeStatus(nextStatus: StatusFilter) {
    setStatus(nextStatus);
    setPage(1);
  }

  function changeBusinessLine(nextBusinessLine: BusinessLineFilter) {
    setBusinessLine(nextBusinessLine);
    setPage(1);
  }

  function changeDateFilter(nextFilter: ServiceDateFilter) {
    setDateFilter(nextFilter);
    setPage(1);
  }

  function changeSort(nextSort: ServiceSort) {
    setSort(nextSort);
    setPage(1);
  }

  function setColumnVisible(column: ServiceColumnKey, checked: boolean) {
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

  function openCreateDialog() {
    setEditingServiceId(null);
    setFormValues(defaultFormValues);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditDialog(service: ServiceSummary) {
    setEditingServiceId(service.id);
    setFormValues(toFormValues(service));
    setFormError(null);
    setActionMenuServiceId(null);
    setFormOpen(true);
  }

  function closeFormDialog() {
    setFormOpen(false);
    setEditingServiceId(null);
    setFormValues(defaultFormValues);
    setFormError(null);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);

    try {
      const result = editingServiceId
        ? await updateServiceAction(editingServiceId, formValues)
        : await createServiceAction(formValues);

      if (!result.ok) {
        const conflict = isVersionConflict(result);
        const nextMessage = conflict
          ? m.services.versionConflict
          : (Object.values(result.errors)[0] ??
            result.message ??
            m.services.formFallbackError);
        setFormError(nextMessage);

        if (conflict) {
          toast.error(nextMessage);
        }
        return;
      }

      toast.success(
        interpolate(m.services.savedToast, { name: result.data.name }),
      );
      closeFormDialog();
      await loadServices();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, m.services.requestFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(service: ServiceSummary) {
    setDeleting(true);

    try {
      const result = await deleteServiceAction(service.id);

      if (!result.ok) {
        const nextMessage = isVersionConflict(result)
          ? m.services.versionConflict
          : (result.message ?? m.services.requestFailed);
        toast.error(nextMessage);
        return;
      }

      toast.success(
        interpolate(m.services.deletedToast, { name: service.name }),
      );
      setPendingDelete(null);
      await loadServices();
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(service: ServiceSummary) {
    setSaving(true);
    setActionMenuServiceId(null);

    try {
      const result = await updateServiceStatusAction(
        service.id,
        service.status === "active" ? "inactive" : "active",
        service.version,
      );

      if (!result.ok) {
        toast.error(
          isVersionConflict(result)
            ? m.services.versionConflict
            : (result.message ?? m.services.requestFailed),
        );
        return;
      }

      toast.success(
        interpolate(m.services.statusUpdatedToast, {
          name: result.data.name,
        }),
      );
      await loadServices();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-7 pb-8" data-testid="tenant-services-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={ClipboardList} size={19} />
          <span>{m.services.title}</span>
        </h1>

        <div className="flex items-center gap-2">
          <Popover onOpenChange={setDateMenuOpen} open={dateMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                aria-label={`${m.services.toolbar.dateLabel}: ${selectedDateLabel}`}
                className="h-8 gap-1.5 px-2.5 text-xs"
                size="sm"
                title={`${m.services.toolbar.dateLabel}: ${selectedDateLabel}`}
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
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={openCreateDialog}
            size="sm"
            type="button"
          >
            <Icon aria-hidden icon={Plus} size={14} />
            {m.services.actions.add}
          </Button>
        </div>
      </header>

      <section
        aria-label={m.services.metrics.label}
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
              {loading ? (
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

      <section className="min-w-0 border-y bg-background">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Popover onOpenChange={setFilterMenuOpen} open={filterMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label={m.services.toolbar.filterLabel}
                  className={cn(
                    (status !== "all" || businessLine !== "all") && "bg-accent",
                  )}
                  size="icon-sm"
                  title={m.services.toolbar.filterLabel}
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden icon={ListFilter} size={15} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2">
                <div>
                  <p className="px-1 text-xs font-semibold">
                    {m.services.formLabels.status}
                  </p>
                  <div className="mt-1 grid gap-1">
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
                          setFilterMenuOpen(false);
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
                </div>

                <div className="mt-2 border-t pt-2">
                  <p className="px-1 text-xs font-semibold">
                    {m.services.formLabels.businessLine}
                  </p>
                  <div className="mt-1 grid gap-1">
                    <button
                      aria-pressed={businessLine === "all"}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                        businessLine === "all" && "bg-accent",
                      )}
                      onClick={() => {
                        changeBusinessLine("all");
                        setFilterMenuOpen(false);
                      }}
                      type="button"
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          businessLine === "all" ? "opacity-100" : "opacity-0",
                        )}
                        icon={Check}
                        size={14}
                      />
                      {m.common.allLines}
                    </button>
                    {businessLineOptions.map((option) => (
                      <button
                        aria-pressed={businessLine === option.value}
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                          businessLine === option.value && "bg-accent",
                        )}
                        key={option.value}
                        onClick={() => {
                          changeBusinessLine(option.value);
                          setFilterMenuOpen(false);
                        }}
                        type="button"
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            businessLine === option.value
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
              </PopoverContent>
            </Popover>

            <div className="relative w-full max-w-sm">
              <label className="sr-only" htmlFor="service-search">
                {m.services.toolbar.searchLabel}
              </label>
              <Icon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                className="h-8 pl-8 text-xs"
                id="service-search"
                inputMode="search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={m.services.searchPlaceholder}
                type="text"
                value={query}
              />
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={m.services.toolbar.settingsLabel}
                size="icon-sm"
                title={m.services.toolbar.settingsLabel}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <div>
                <p className="px-1 text-xs font-semibold">
                  {m.services.toolbar.sortTitle}
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
                  {m.services.toolbar.columnsTitle}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {SERVICE_COLUMN_KEYS.map((column) => {
                    const isLastVisible =
                      visibleColumns[column] && visibleColumnCount === 1;

                    return (
                      <label
                        className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                        htmlFor={`service-column-${column}`}
                        key={column}
                      >
                        <Checkbox
                          checked={visibleColumns[column]}
                          disabled={isLastVisible}
                          id={`service-column-${column}`}
                          onCheckedChange={(checked) =>
                            setColumnVisible(column, checked === true)
                          }
                        />
                        <span className="truncate">
                          {m.services.columns[column]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                className="h-9 animate-pulse rounded-md bg-muted"
                key={row}
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button
                onClick={() => void loadServices()}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.common.retry}
              </Button>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h2 className="text-base font-semibold">
                {hasActiveFilters
                  ? m.services.filteredEmptyTitle
                  : m.services.empty}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? m.services.filteredEmptyDescription
                  : m.services.emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <Table
            className="text-xs [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-1.5"
            style={{
              minWidth: `${Math.max(620, visibleColumnCount * 118 + 84)}px`,
            }}
          >
            <TableHeader>
              <TableRow>
                {visibleColumns.service ? (
                  <TableHead>{m.services.columns.service}</TableHead>
                ) : null}
                {visibleColumns.businessLine ? (
                  <TableHead>{m.services.columns.businessLine}</TableHead>
                ) : null}
                {visibleColumns.pricing ? (
                  <TableHead>{m.services.columns.pricing}</TableHead>
                ) : null}
                {visibleColumns.status ? (
                  <TableHead>{m.services.columns.status}</TableHead>
                ) : null}
                {visibleColumns.createdAt ? (
                  <TableHead>{m.services.columns.createdAt}</TableHead>
                ) : null}
                <TableHead className="w-12 text-right">
                  {m.services.columns.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  {visibleColumns.service ? (
                    <TableCell className="font-medium">
                      {service.name}
                    </TableCell>
                  ) : null}
                  {visibleColumns.businessLine ? (
                    <TableCell>
                      {m.common.businessLineLabels[service.businessLine]}
                    </TableCell>
                  ) : null}
                  {visibleColumns.pricing ? (
                    <TableCell>
                      {m.common.pricingUnitLabels[service.pricingUnit]}
                    </TableCell>
                  ) : null}
                  {visibleColumns.status ? (
                    <TableCell>
                      <Badge
                        className="px-1.5 py-px text-[11px]"
                        variant={
                          service.status === "active" ? "default" : "outline"
                        }
                      >
                        {m.common.statusLabels[service.status]}
                      </Badge>
                    </TableCell>
                  ) : null}
                  {visibleColumns.createdAt ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(service.createdAt)}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <Popover
                      onOpenChange={(open) =>
                        setActionMenuServiceId(open ? service.id : null)
                      }
                      open={actionMenuServiceId === service.id}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          aria-label={`${m.services.actions.menu}: ${service.name}`}
                          size="icon-sm"
                          title={m.services.actions.menu}
                          type="button"
                          variant="ghost"
                        >
                          <Icon aria-hidden icon={Ellipsis} size={15} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 p-1.5">
                        <div className="grid gap-1">
                          <button
                            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent"
                            onClick={() => openEditDialog(service)}
                            type="button"
                          >
                            <Icon aria-hidden icon={Pencil} size={14} />
                            {m.services.actions.edit}
                          </button>
                          <button
                            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent"
                            disabled={saving}
                            onClick={() => void handleStatusChange(service)}
                            type="button"
                          >
                            <Icon aria-hidden icon={Power} size={14} />
                            {service.status === "active"
                              ? m.services.actions.deactivate
                              : m.services.actions.activate}
                          </button>
                          <button
                            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                            onClick={() => {
                              setActionMenuServiceId(null);
                              setPendingDelete(service);
                            }}
                            type="button"
                          >
                            <Icon aria-hidden icon={Trash2} size={14} />
                            {m.services.actions.delete}
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {interpolate(m.services.pageSummary, {
              page: currentPage.toLocaleString(locale),
              pages: totalPages.toLocaleString(locale),
            })}
          </span>
          <div className="flex gap-2">
            <Button
              className="h-7 px-2 text-xs"
              disabled={currentPage <= 1 || loading}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.common.previous}
            </Button>
            <Button
              className="h-7 px-2 text-xs"
              disabled={currentPage >= totalPages || loading}
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
          }
        }}
        open={formOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingServiceId
                ? m.services.formDialog.editTitle
                : m.services.formDialog.createTitle}
            </DialogTitle>
            <DialogDescription>
              {editingServiceId
                ? m.services.formDialog.editDescription
                : m.services.formDialog.createDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="service-name">{m.services.formLabels.name}</Label>
              <Input
                id="service-name"
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={formValues.name}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="service-form-business-line">
                {m.services.formLabels.businessLine}
              </Label>
              <Select
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    businessLine: value as ServiceBusinessLine,
                  }))
                }
                value={formValues.businessLine}
              >
                <SelectTrigger id="service-form-business-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businessLineOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="service-pricing-unit">
                {m.services.formLabels.pricing}
              </Label>
              <Select
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    pricingUnit: value as ServiceFormValues["pricingUnit"],
                  }))
                }
                value={formValues.pricingUnit}
              >
                <SelectTrigger id="service-pricing-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_item">
                    {m.common.pricingUnitLabels.per_item}
                  </SelectItem>
                  <SelectItem value="per_kg">
                    {m.common.pricingUnitLabels.per_kg}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="service-form-status">
                {m.services.formLabels.status}
              </Label>
              <Select
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    status: value as ServiceStatus,
                  }))
                }
                value={formValues.status}
              >
                <SelectTrigger id="service-form-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {m.common.statusLabels.active}
                  </SelectItem>
                  <SelectItem value="inactive">
                    {m.common.statusLabels.inactive}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              disabled={saving}
              onClick={closeFormDialog}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button disabled={saving} onClick={handleSubmit} type="button">
              {saving
                ? m.services.formButtons.saving
                : editingServiceId
                  ? m.services.formButtons.updateService
                  : m.services.formButtons.createService}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        open={pendingDelete !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.services.delete.title}</DialogTitle>
            <DialogDescription>
              {m.services.delete.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              {m.common.cancel}
            </Button>
            <Button
              disabled={deleting}
              onClick={() => pendingDelete && void handleDelete(pendingDelete)}
              type="button"
              variant="destructive"
            >
              {deleting ? m.services.delete.deleting : m.services.delete.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
