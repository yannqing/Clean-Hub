"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cleanhub/ui";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";
import { canCreateTenant } from "@/lib/permissions";

import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantDialogContentClass, tenantStatusOptions } from "../constants";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { getTenantListQuery } from "../queries";
import type { TenantStatus, TenantStatusCounts, TenantSummary } from "../types";
import { TenantDetailView } from "./tenant-detail-view";
import { TenantSettingsView } from "./tenant-settings-view";

type StatusFilter = "all" | TenantStatus;
type TenantMetrics = TenantStatusCounts & {
  total: number;
};
type MetricItem = {
  label: string;
  value: number;
};

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
  const { m, formatDate } = useSaasI18n();
  const captionId = useId();
  const requestIdRef = useRef(0);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [metrics, setMetrics] = useState<TenantMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
  const [settingsTenantId, setSettingsTenantId] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      limit: 50,
      offset: 0,
      q: query.trim() || undefined,
      status: status === "all" ? undefined : status,
    }),
    [query, status],
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
      { label: m.tenants.list.metrics.total, value: metrics.total },
      { label: m.tenants.list.metrics.active, value: metrics.active },
      { label: m.tenants.list.metrics.suspended, value: metrics.suspended },
      { label: m.tenants.list.metrics.disabled, value: metrics.disabled },
    ],
    [m.tenants.list.metrics, metrics],
  );

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
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.tenants.list.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.tenants.list.title}
          </h1>
        </div>

        {canCreateTenant(authContext) ? (
          <Button asChild>
            <Link href={webAdminRoutes.saas.newTenant}>{m.tenants.list.newTenant}</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-4">
        {metricItems.map((item) => (
          <div className="rounded-md border bg-background p-4" key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-end">
        <div className="grid gap-2">
          <Label htmlFor="tenant-search">{m.common.search}</Label>
          <Input
            id="tenant-search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={m.tenants.list.searchPlaceholder}
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tenant-status-filter">{m.common.status}</Label>
          <Select
            onValueChange={(value) => {
              setStatus(value as StatusFilter);
            }}
            value={status}
          >
            <SelectTrigger className="w-full" id="tenant-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.common.allStatuses}</SelectItem>
              {tenantStatusOptions.map((option) => {
                const label =
                  option.value === "active"
                    ? m.common.statusLabels.active
                    : option.value === "suspended"
                      ? m.common.statusLabels.suspended
                      : m.common.statusLabels.disabled;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <Button
          disabled={loading}
          onClick={loadTenants}
          type="button"
          variant="outline"
        >
          {m.common.refresh}
        </Button>
        <Button
          disabled={loading || (!query.trim() && status === "all")}
          onClick={resetFilters}
          type="button"
          variant="outline"
        >
          {m.common.clear}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5">
          {[0, 1, 2].map((item) => (
            <div
              className="h-14 animate-pulse rounded-md bg-muted"
              key={item}
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="grid gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{error}</p>
            <div>
              <Button
                onClick={loadTenants}
                size="sm"
                type="button"
                variant="outline"
              >
                {m.common.tryAgain}
              </Button>
            </div>
          </div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">{m.tenants.list.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {getEmptyStateMessage(
                query,
                status,
                m.tenants.list.emptyFiltered,
                m.tenants.list.emptyDefault,
              )}
            </p>
            {(query.trim() || status !== "all") && (
              <div>
                <Button onClick={resetFilters} type="button" variant="outline">
                  {m.common.clearFilters}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Table aria-describedby={captionId}>
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
                <TableHead className="text-right">{m.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tenant.id}
                    </div>
                  </TableCell>
                  <TableCell>{tenant.pressingCode}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(tenant.status)}>
                      {m.common.statusLabels[tenant.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{tenant.country?.trim() || m.common.notSet}</TableCell>
                  <TableCell>{tenant.city?.trim() || m.common.notSet}</TableCell>
                  <TableCell>
                    {formatDate(tenant.createdAt) || m.common.invalidDate}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          setSettingsTenantId(null);
                          setDetailTenantId(tenant.id);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {m.tenants.list.detail}
                      </Button>
                      <Button
                        onClick={() => {
                          setDetailTenantId(null);
                          setSettingsTenantId(tenant.id);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {m.tenants.list.settings}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDetailTenantId(null);
          }
        }}
        open={detailTenantId !== null}
      >
        <DialogContent className={tenantDialogContentClass}>
          {detailTenantId ? (
            <TenantDetailView
              key={detailTenantId}
              onOpenSettings={() => {
                setSettingsTenantId(detailTenantId);
                setDetailTenantId(null);
              }}
              onTenantUpdated={loadTenants}
              presentation="dialog"
              tenantId={detailTenantId}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSettingsTenantId(null);
          }
        }}
        open={settingsTenantId !== null}
      >
        <DialogContent className={tenantDialogContentClass}>
          {settingsTenantId ? (
            <TenantSettingsView
              key={settingsTenantId}
              onTenantUpdated={loadTenants}
              presentation="dialog"
              tenantId={settingsTenantId}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
