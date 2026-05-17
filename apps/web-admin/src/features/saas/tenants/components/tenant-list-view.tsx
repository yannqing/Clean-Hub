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
import { useCallback, useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { tenantStatusLabels, tenantStatusOptions } from "../constants";
import { getTenantListQuery } from "../queries";
import type { TenantStatus, TenantStatusCounts, TenantSummary } from "../types";

type StatusFilter = "all" | TenantStatus;
type TenantMetrics = TenantStatusCounts & {
  total: number;
};

const emptyMetrics: TenantMetrics = {
  active: 0,
  suspended: 0,
  disabled: 0,
  total: 0,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load tenants.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getStatusVariant(status: TenantStatus): "default" | "outline" | "secondary" {
  if (status === "active") {
    return "default";
  }

  if (status === "suspended") {
    return "secondary";
  }

  return "outline";
}

export function TenantListView() {
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

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTenantListQuery(listQuery);
      setTenants(response.data);
      setMetrics({
        ...response.meta.statusCounts,
        total: response.meta.total,
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  useEffect(() => {
    let isCurrent = true;

    getTenantListQuery(listQuery)
      .then((response) => {
        if (!isCurrent) {
          return;
        }

        setTenants(response.data);
        setMetrics({
          ...response.meta.statusCounts,
          total: response.meta.total,
        });
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [listQuery]);

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
        {[
          ["Total", metrics.total],
          ["Active", metrics.active],
          ["Suspended", metrics.suspended],
          ["Disabled", metrics.disabled],
        ].map(([label, value]) => (
          <div className="rounded-md border bg-background p-4" key={label}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-b p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
        <div className="grid gap-2">
          <Label htmlFor="tenant-search">Search</Label>
          <Input
            id="tenant-search"
            onChange={(event) => {
              setLoading(true);
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
              setLoading(true);
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

        <Button onClick={loadTenants} type="button" variant="outline">
          Refresh
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
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : tenants.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">No tenants found</h2>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Pressing code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div className="font-medium">{tenant.name}</div>
                  <div className="text-xs text-muted-foreground">{tenant.id}</div>
                </TableCell>
                <TableCell>{tenant.pressingCode}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(tenant.status)}>
                    {tenantStatusLabels[tenant.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {[tenant.city, tenant.country].filter(Boolean).join(", ") ||
                    "Not set"}
                </TableCell>
                <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`${webAdminRoutes.saas.tenants}/${tenant.id}`}>
                      Detail
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
