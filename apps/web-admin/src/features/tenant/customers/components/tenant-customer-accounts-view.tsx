"use client";

import type {
  TenantCustomerAccountOverview,
  TenantCustomerAccountSort,
  TenantCustomerAccountSummary,
  TenantCustomerStatus,
} from "@cleanhub/api-client";
import {
  Badge,
  Button,
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
  ContactRound,
  Check,
  ListFilter,
  Search,
  SlidersHorizontal,
  UserCheck,
  UsersRound,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { interpolate, useTenantI18n } from "@/i18n";

import {
  getTenantCustomerAccountListQuery,
  getTenantCustomerAccountOverviewQuery,
} from "../queries";

const PAGE_SIZE = 10;
type AccountStatusFilter = "all" | TenantCustomerStatus;

function statusVariant(status: TenantCustomerStatus): "default" | "outline" {
  return status === "active" ? "default" : "outline";
}

export function TenantCustomerAccountsView({
  initialSearchQuery = "",
}: {
  initialSearchQuery?: string;
}) {
  const router = useRouter();
  const { formatDateTime, locale, m } = useTenantI18n();
  const copy = m.customers.accounts;
  const [accounts, setAccounts] = useState<TenantCustomerAccountSummary[]>([]);
  const [overview, setOverview] =
    useState<TenantCustomerAccountOverview | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialSearchQuery.trim(),
  );
  const [status, setStatus] = useState<AccountStatusFilter>("all");
  const [sort, setSort] =
    useState<TenantCustomerAccountSort>("created_desc");
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch === debouncedSearch) return;
      setLoading(true);
      setError(null);
      setDebouncedSearch(nextSearch);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [debouncedSearch, search]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantCustomerAccountListQuery(
      {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        q: debouncedSearch || undefined,
        sort,
        status: status === "all" ? undefined : status,
      },
      { signal: controller.signal },
    )
      .then((result) => {
        if (!current) return;
        setAccounts(result.data);
        setTotal(result.total);
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
      })
      .catch((loadError: unknown) => {
        if (!current || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : copy.loadError);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [copy.loadError, debouncedSearch, page, refreshVersion, sort, status]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();

    getTenantCustomerAccountOverviewQuery({ signal: controller.signal })
      .then((result) => {
        if (!current) return;
        setOverview(result);
        setOverviewError(null);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          setOverviewError(copy.loadError);
        }
      })
      .finally(() => {
        if (current) setOverviewLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [copy.loadError, refreshVersion]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const hasFilters = debouncedSearch.length > 0 || status !== "all";
  const statusOptions = useMemo(
    () => [
      { label: copy.allStatuses, value: "all" as const },
      { label: m.customers.statusLabels.active, value: "active" as const },
      { label: m.customers.statusLabels.disabled, value: "disabled" as const },
    ],
    [copy.allStatuses, m.customers.statusLabels],
  );
  const sortOptions = useMemo(
    () => [
      { label: copy.sortOptions.createdDesc, value: "created_desc" as const },
      { label: copy.sortOptions.createdAsc, value: "created_asc" as const },
      { label: copy.sortOptions.nameAsc, value: "name_asc" as const },
      { label: copy.sortOptions.nameDesc, value: "name_desc" as const },
    ],
    [copy.sortOptions],
  );
  const metrics = useMemo(
    () => [
      {
        icon: UsersRound,
        label: copy.metrics.totalAccounts,
        value: overview?.totalAccounts.toLocaleString(locale) ?? "—",
      },
      {
        icon: UserCheck,
        label: copy.metrics.activeAccounts,
        value: overview?.activeAccounts.toLocaleString(locale) ?? "—",
      },
      {
        icon: UserX,
        label: copy.metrics.disabledAccounts,
        value: overview?.disabledAccounts.toLocaleString(locale) ?? "—",
      },
      {
        icon: ContactRound,
        label: copy.metrics.linkedCustomers,
        value: overview?.linkedCustomers.toLocaleString(locale) ?? "—",
      },
    ],
    [copy.metrics, locale, overview],
  );

  function refresh() {
    setLoading(true);
    setOverviewLoading(true);
    setError(null);
    setOverviewError(null);
    setRefreshVersion((value) => value + 1);
  }

  return (
    <section className="space-y-6 pb-8" data-testid="tenant-customer-accounts-view">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={UsersRound} size={19} />
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </header>

      <DataTableMetricCards
        ariaLabel={copy.metrics.label}
        loading={overviewLoading}
        metrics={metrics}
      />

      {overviewError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{overviewError}</span>
          <Button onClick={refresh} size="sm" type="button" variant="outline">
            {m.common.retry}
          </Button>
        </div>
      ) : null}

      <DataTableSurface>
        <DataTableToolbar>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-label={copy.statusLabel}
                  className={cn(status !== "all" && "bg-accent")}
                  size="icon-sm"
                  title={copy.statusLabel}
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden icon={ListFilter} size={15} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1.5">
                {statusOptions.map((option) => (
                  <button
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-accent",
                      status === option.value && "bg-accent",
                    )}
                    key={option.value}
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      setStatus(option.value);
                      setPage(1);
                    }}
                    type="button"
                  >
                    <Icon
                      aria-hidden
                      className={
                        status === option.value ? "opacity-100" : "opacity-0"
                      }
                      icon={Check}
                      size={14}
                    />
                    {option.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <div className="relative w-full max-w-sm">
              <label
                className="sr-only"
                htmlFor="tenant-customer-account-search"
              >
                {copy.searchLabel}
              </label>
              <Icon
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                icon={Search}
                size={14}
              />
              <Input
                className="h-8 pl-8 text-xs"
                id="tenant-customer-account-search"
                inputMode="search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
                value={search}
              />
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={copy.sortLabel}
                size="icon-sm"
                title={copy.sortLabel}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={SlidersHorizontal} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1.5">
              {sortOptions.map((option) => (
                <button
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-accent",
                    sort === option.value && "bg-accent",
                  )}
                  key={option.value}
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    setSort(option.value);
                    setPage(1);
                  }}
                  type="button"
                >
                  <Icon
                    aria-hidden
                    className={sort === option.value ? "opacity-100" : "opacity-0"}
                    icon={Check}
                    size={14}
                  />
                  {option.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </DataTableToolbar>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div className="h-9 animate-pulse rounded-md bg-muted" key={row} />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <span>{error || copy.loadError}</span>
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
        ) : accounts.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <h2 className="text-base font-semibold">
              {hasFilters ? copy.filteredEmptyTitle : copy.emptyTitle}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilters ? copy.filteredEmptyDescription : copy.emptyDescription}
            </p>
          </div>
        ) : (
          <DataTable className="text-xs [&_td]:py-2 [&_th]:h-9">
            <TableHeader>
              <TableRow>
                <TableHead>{copy.columns.account}</TableHead>
                <TableHead>{copy.columns.customers}</TableHead>
                <TableHead>{copy.columns.phone}</TableHead>
                <TableHead>{copy.columns.email}</TableHead>
                <TableHead>{copy.columns.status}</TableHead>
                <TableHead>{copy.columns.createdAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  aria-label={interpolate(copy.detail.openAccount, {
                    account: account.accountName,
                  })}
                  className="cursor-pointer transition-colors focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  key={account.id}
                  onClick={() =>
                    router.push(webAdminRoutes.tenant.customerAccount(account.id))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(webAdminRoutes.tenant.customerAccount(account.id));
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <TableCell className="font-medium">{account.accountName}</TableCell>
                  <TableCell>{account.customerCount.toLocaleString(locale)}</TableCell>
                  <TableCell>{account.phone || m.customers.notProvided}</TableCell>
                  <TableCell>{account.email || m.customers.notProvided}</TableCell>
                  <TableCell>
                    <Badge
                      className="px-1.5 py-px text-[11px]"
                      variant={statusVariant(account.status)}
                    >
                      {m.customers.statusLabels[account.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(account.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}

        <DataTablePagePagination
          loading={loading}
          nextLabel={m.common.next}
          onPageChange={(nextPage) => {
            setLoading(true);
            setError(null);
            setPage(nextPage);
          }}
          page={currentPage}
          previousLabel={m.common.previous}
          summary={interpolate(copy.pageSummary, {
              page: currentPage.toLocaleString(locale),
              pages: totalPages.toLocaleString(locale),
              total: total.toLocaleString(locale),
            })}
          totalPages={totalPages}
        />
      </DataTableSurface>
    </section>
  );
}
