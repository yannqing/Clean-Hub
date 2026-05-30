"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { getTenantOverviewQuery } from "../queries";
import type { TenantOverview } from "../types";

const metricLabels = [
  ["todayOrderCount", "Today's orders"],
  ["todayRevenueAmount", "Today's revenue"],
  ["pendingPickupCount", "Pending pickup"],
  ["inProgressOrderCount", "In progress"],
  ["pendingTasksCount", "Pending tasks"],
] as const;

const quickLinks = [
  ["Branches", webAdminRoutes.tenant.branches],
  ["Users", webAdminRoutes.tenant.users],
  ["Services", webAdminRoutes.tenant.services],
  ["Prices", webAdminRoutes.tenant.prices],
  ["Reports", webAdminRoutes.tenant.reports],
] as const;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Tenant overview failed to load.";
}

export type TenantOverviewViewProps = {
  initialOverview?: TenantOverview;
};

export function TenantOverviewView({
  initialOverview,
}: TenantOverviewViewProps = {}) {
  const [overview, setOverview] = useState<TenantOverview | null>(
    initialOverview ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialOverview);
  const enabledFeatureCount = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return Object.values(overview.featureFlags).filter(Boolean).length;
  }, [overview]);

  useEffect(() => {
    if (initialOverview) {
      setOverview(initialOverview);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    let isCurrent = true;

    getTenantOverviewQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setOverview(data);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        setOverview(null);
        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [initialOverview]);

  if (loading) {
    return (
      <section className="grid gap-5 p-5">
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-5">
          {metricLabels.map(([key]) => (
            <div key={key} className="h-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (errorMessage || !overview) {
    return (
      <section className="p-5">
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {errorMessage ?? "Tenant overview is unavailable."}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant Admin</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {overview.tenantName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Order metrics are placeholders until the order module is connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{overview.tenantStatus}</Badge>
          <Badge variant="outline">{enabledFeatureCount} features enabled</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {metricLabels.map(([key, label]) => (
          <div key={key} className="rounded-md border bg-background p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold">
              {overview[key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <h2 className="text-base font-semibold">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(([label, href]) => (
            <Button asChild key={href} variant="outline">
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
