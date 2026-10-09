"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@cleanhub/ui";
import { DataTable } from "@cleanhub/ui/data-table";
import {
  Building2,
  Check,
  CircleCheck,
  CirclePause,
  CircleX,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Pagination } from "@/components/pagination";
import { webAdminRoutes } from "@/config/routes";
import {
  SaasMetricStrip,
  SaasPageHeader,
  SaasTableSurface,
  saasCompactTableClassName,
} from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { canCreateTenant } from "@/lib/permissions";

import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantStatusOptions } from "../constants";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { getTenantListQuery } from "../queries";
import type { TenantStatus, TenantStatusCounts, TenantSummary } from "../types";

type StatusFilter = "all" | TenantStatus;
type TenantMetrics = TenantStatusCounts & {
  total: number;
};
type MetricItem = {
  icon: typeof Building2;
  label: string;
  value: number;
};

const PAGE_SIZE = 10;

const emptyMetrics: TenantMetrics = {
  active: 0,
  suspended: 0,
  disabled: 0,
  total: 0,
};

function getStatusVariant(
  status: TenantStatus,
): "default" | "outline" | "secondary" {
  if (status === "active") {
    return "default";
  }

  if (status === "suspended") {
    return "secondary";
  }

  return "outline";
}

function getEmptyStateMessage(
  query: string,
  status: StatusFilter,
  filteredMessage: string,
  defaultMessage: string,
): string {
  if (query.trim() || status !== "all") {
    return filteredMessage;
  }

  return defaultMessage;
}

export function TenantListView() {
  const router = useRouter();
  const { locale, m, formatDate } = useSaasI18n();
  const captionId = useId();
  const requestIdRef = useRef(0);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<TenantMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [offset, query, status],
  );
  const metricsQuery = useMemo(
    () => ({
      limit: 1,
      offset: 0,
      q: query.trim() || undefined,
    }),
    [query],
  );
  const metricItems: MetricItem[] = useMemo(
    () => [
      {
        icon: Building2,
        label: m.tenants.list.metrics.total,
        value: metrics.total,
      },
      {
        icon: CircleCheck,
        label: m.tenants.list.metrics.active,
        value: metrics.active,
      },
      {
        icon: CirclePause,
        label: m.tenants.list.metrics.suspended,
        value: metrics.suspended,
      },
      {
        icon: CircleX,
        label: m.tenants.list.metrics.disabled,
        value: metrics.disabled,
      },
    ],
    [m.tenants.list.metrics, metrics],
  );
  const statusFilterOptions = useMemo(
    () => [
      { label: m.common.allStatuses, value: "all" as const },
      ...tenantStatusOptions.map((option) => ({
        label: m.common.statusLabels[option.value],
        value: option.value,
      })),
    ],
    [m.common.allStatuses, m.common.statusLabels],
  );
  const selectedStatusLabel =
    statusFilterOptions.find((option) => option.value === status)?.label ??
    m.common.allStatuses;

  const loadTenants = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const tenantRequest =
        status === "all"
          ? getTenantListQuery(listQuery).then((tenantResponse) => [
              tenantResponse,
              tenantResponse,
            ])
          : Promise.all([
              getTenantListQuery(listQuery),
              getTenantListQuery(metricsQuery),
            ]);
      const [authResult, tenantResults] = await Promise.allSettled([
        getCurrentAuthQuery(),
        tenantRequest,
      ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (authResult.status === "fulfilled") {
        setAuthContext(authResult.value);
      } else {
        setAuthContext(null);
      }

      if (tenantResults.status === "rejected") {
        throw tenantResults.reason;
      }

      const [response, metricsResponse] = tenantResults.value;

      setTenants(response.data);
      setTotal(response.meta.total);
      setMetrics({
        ...metricsResponse.meta.statusCounts,
        total: metricsResponse.meta.total,
      });
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(getTenantLoadErrorMessage(loadError, m.tenants.list.loadError));
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [listQuery, m.tenants.list.loadError, metricsQuery, status]);

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setOffset(0);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTenants();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTenants]);

  return (
    <section className="space-y-7 pb-8" data-testid="saas-tenant-list-view">
      <SaasPageHeader
        actions={
          canCreateTenant(authContext) ? (
            <Button asChild className="h-8 gap-1.5 px-2.5 text-xs" size="sm">
              <Link href={webAdminRoutes.saas.newTenant}>
                <Icon aria-hidden icon={Plus} size={14} />
                <span>{m.tenants.list.newTenant}</span>
              </Link>
            </Button>
          ) : null
        }
        icon={Building2}
        title={m.tenants.list.title}
      />

      <SaasMetricStrip
        ariaLabel={m.tenants.list.title}
        loading={loading}
        metrics={metricItems}
      />

      <SaasTableSurface>
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Popover onOpenChange={setStatusMenuOpen} open={statusMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                aria-label={`${m.common.status}: ${selectedStatusLabel}`}
                className={cn(status !== "all" && "bg-accent")}
                size="icon-sm"
                title={`${m.common.status}: ${selectedStatusLabel}`}
                type="button"
                variant="outline"
              >
                <Icon aria-hidden icon={ListFilter} size={15} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1.5">
              <div className="grid gap-1">
                {statusFilterOptions.map((option) => (
                  <button
                    aria-pressed={status === option.value}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-accent",
                      status === option.value && "bg-accent",
                    )}
                    key={option.value}
                    onClick={() => {
                      setStatus(option.value);
                      setOffset(0);
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
            <label className="sr-only" htmlFor="tenant-search">
              {m.common.search}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={14}
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="tenant-search"
              inputMode="search"
              onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
              }}
              placeholder={m.tenants.list.searchPlaceholder}
              type="search"
              value={query}
            />
          </div>

          {query.trim() || status !== "all" ? (
            <Button
              aria-label={m.common.clearFilters}
              onClick={resetFilters}
              size="icon-sm"
              title={m.common.clearFilters}
              type="button"
              variant="ghost"
            >
              <Icon aria-hidden icon={X} size={15} />
            </Button>
          ) : null}

          <Button
            aria-label={m.common.refresh}
            className="ml-auto"
            disabled={loading}
            onClick={loadTenants}
            size="icon-sm"
            title={m.common.refresh}
            type="button"
            variant="outline"
          >
            <Icon aria-hidden icon={RefreshCw} size={15} />
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                className="h-10 animate-pulse rounded-md bg-muted"
                key={item}
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button
                className="h-8 px-2.5 text-xs"
                onClick={loadTenants}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.common.tryAgain}
              </Button>
            </div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-4">
            <div className="border-y border-dashed px-4 py-14 text-center">
              <h2 className="text-sm font-semibold">
                {m.tenants.list.emptyTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {getEmptyStateMessage(
                  query,
                  status,
                  m.tenants.list.emptyFiltered,
                  m.tenants.list.emptyDefault,
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              aria-describedby={captionId}
              className={saasCompactTableClassName}
            >
              <TableCaption className="sr-only" id={captionId}>
                {m.tenants.list.title}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.tenants.list.columns.name}</TableHead>
                  <TableHead>{m.tenants.list.columns.pressingCode}</TableHead>
                  <TableHead>{m.tenants.list.columns.status}</TableHead>
                  <TableHead>{m.tenants.list.columns.country}</TableHead>
                  <TableHead>{m.tenants.list.columns.city}</TableHead>
                  <TableHead>{m.tenants.list.columns.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const detailHref = webAdminRoutes.saas.tenant(tenant.id);

                  return (
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      key={tenant.id}
                      onClick={() => router.push(detailHref)}
                      onMouseEnter={() => router.prefetch(detailHref)}
                    >
                      <TableCell>
                        <Link
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          href={detailHref}
                          onClick={(event) => event.stopPropagation()}
                          onFocus={() => router.prefetch(detailHref)}
                        >
                          {tenant.name}
                        </Link>
                      </TableCell>
                      <TableCell>{tenant.pressingCode}</TableCell>
                      <TableCell>
                        <Badge
                          className="px-1.5 py-px text-[11px]"
                          variant={getStatusVariant(tenant.status)}
                        >
                          {m.common.statusLabels[tenant.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.country?.trim() || m.common.notSet}
                      </TableCell>
                      <TableCell>
                        {tenant.city?.trim() || m.common.notSet}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(tenant.createdAt) || m.common.invalidDate}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </DataTable>
          </div>
        )}

        {!loading && !error ? (
          <Pagination
            currentPageCount={tenants.length}
            formatCountLabel={({ from, to, total: itemTotal }) =>
              locale === "zh-CN"
                ? `${from}–${to} / 共 ${itemTotal} 条`
                : `${from}–${to} of ${itemTotal}`
            }
            nextLabel={m.common.nextPage}
            offset={offset}
            onOffsetChange={setOffset}
            pageSize={PAGE_SIZE}
            previousLabel={m.common.previousPage}
            total={total}
          />
        ) : null}
      </SaasTableSurface>
    </section>
  );
}
