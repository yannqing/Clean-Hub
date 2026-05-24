"use client";

import {
  Badge,
  Button,
  Input,
  Label,
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
} from "@cleanhub/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantStatusLabels, tenantStatusOptions } from "../constants";
import { getTenantListQuery } from "../queries";
import type { TenantStatus, TenantStatusCounts, TenantSummary } from "../types";

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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

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

function getEmptyStateMessage(query: string, status: StatusFilter): string {
  if (query.trim() || status !== "all") {
    return "No tenants match the current search or status filter.";
  }

  return "No tenants have been created yet.";
}

function getLocationValue(value: string | null): string {
  return value?.trim() || "Not set";
}

function getTenantDetailHref(tenantId: string): string {
  return `${webAdminRoutes.saas.tenants}/${tenantId}`;
}

function getTenantSettingsHref(tenantId: string): string {
  return `${getTenantDetailHref(tenantId)}/settings`;
}

export function TenantListView() {
  const requestIdRef = useRef(0);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [metrics, setMetrics] = useState<TenantMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      { label: "Total", value: metrics.total },
      { label: "Active", value: metrics.active },
      { label: "Suspended", value: metrics.suspended },
      { label: "Disabled", value: metrics.disabled },
    ],
    [metrics],
  );

  const loadTenants = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const [response, metricsResponse] =
        status === "all"
          ? await getTenantListQuery(listQuery).then((tenantResponse) => [
              tenantResponse,
              tenantResponse,
            ])
          : await Promise.all([
              getTenantListQuery(listQuery),
              getTenantListQuery(metricsQuery),
            ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      setTenants(response.data);
      setMetrics({
        ...metricsResponse.meta.statusCounts,
        total: metricsResponse.meta.total,
      });
    } catch (loadError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setError(getTenantLoadErrorMessage(loadError, "Failed to load tenants."));
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [listQuery, metricsQuery, status]);

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
          <Badge variant="secondary">SaaS tenants</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Tenant Management
          </h1>
        </div>

        <Button asChild>
          <Link href={webAdminRoutes.saas.newTenant}>New tenant</Link>
        </Button>
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
          <Label htmlFor="tenant-search">Search</Label>
          <Input
            id="tenant-search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Name, code, country, city"
            value={query}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tenant-status-filter">Status</Label>
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
              <SelectItem value="all">All statuses</SelectItem>
              {tenantStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          disabled={loading}
          onClick={loadTenants}
          type="button"
          variant="outline"
        >
          Refresh
        </Button>
        <Button
          disabled={loading || (!query.trim() && status === "all")}
          onClick={resetFilters}
          type="button"
          variant="outline"
        >
          Clear
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
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No tenants found</h2>
            <p className="text-sm text-muted-foreground">
              {getEmptyStateMessage(query, status)}
            </p>
            {(query.trim() || status !== "all") && (
              <div>
                <Button onClick={resetFilters} type="button" variant="outline">
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant name</TableHead>
                <TableHead>Pressing code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      {tenantStatusLabels[tenant.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{getLocationValue(tenant.country)}</TableCell>
                  <TableCell>{getLocationValue(tenant.city)}</TableCell>
                  <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={getTenantDetailHref(tenant.id)}>
                          Detail
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={getTenantSettingsHref(tenant.id)}>
                          Settings
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
