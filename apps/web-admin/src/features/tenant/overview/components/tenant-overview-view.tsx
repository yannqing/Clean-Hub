"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { BRANCH_LIST_LIMIT, getBranchListQuery } from "../../branches/queries";
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
  ["Create branch", `${webAdminRoutes.tenant.branches}/new`],
  ["Settings", webAdminRoutes.tenant.system.settings],
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
  initialBranchCount?: number;
  initialBranchCountReachedLimit?: boolean;
  initialOverview?: TenantOverview;
};

export function TenantOverviewView({
  initialBranchCount,
  initialBranchCountReachedLimit,
  initialOverview,
}: TenantOverviewViewProps = {}) {
  const [overview, setOverview] = useState<TenantOverview | null>(
    initialOverview ?? null,
  );
  const [branchCount, setBranchCount] = useState(initialBranchCount);
  const [branchCountReachedLimit, setBranchCountReachedLimit] = useState(
    initialBranchCountReachedLimit ?? false,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialOverview);
  const enabledFeatureCount = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return Object.values(overview.featureFlags).filter(Boolean).length;
  }, [overview]);

  async function loadOverview() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [overviewResult, branchesResult] = await Promise.allSettled([
        getTenantOverviewQuery(),
        getBranchListQuery(),
      ]);

      if (overviewResult.status === "rejected") {
        throw overviewResult.reason;
      }

      setOverview(overviewResult.value);
      setBranchCount(
        branchesResult.status === "fulfilled"
          ? branchesResult.value.length
          : undefined,
      );
      setBranchCountReachedLimit(
        branchesResult.status === "fulfilled" &&
          branchesResult.value.length === BRANCH_LIST_LIMIT,
      );
    } catch (error) {
      setOverview(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialOverview) {
      return;
    }

    let isCurrent = true;

    Promise.allSettled([getTenantOverviewQuery(), getBranchListQuery()])
      .then(([overviewResult, branchesResult]) => {
        if (!isCurrent) {
          return;
        }

        if (overviewResult.status === "rejected") {
          throw overviewResult.reason;
        }

        setOverview(overviewResult.value);
        setBranchCount(
          branchesResult.status === "fulfilled"
            ? branchesResult.value.length
            : undefined,
        );
        setBranchCountReachedLimit(
          branchesResult.status === "fulfilled" &&
            branchesResult.value.length === BRANCH_LIST_LIMIT,
        );
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
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage ?? "Tenant overview is unavailable."}</span>
          <Button
            onClick={loadOverview}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
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
            Daily operating snapshot for the current tenant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{overview.tenantStatus}</Badge>
          <Badge variant="outline">{enabledFeatureCount} features enabled</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">Visible branches</p>
          <p className="mt-3 text-2xl font-semibold">
            {branchCountReachedLimit
              ? `${branchCount} shown`
              : (branchCount?.toLocaleString() ?? "Unavailable")}
          </p>
        </div>
        {metricLabels.map(([key, label]) => (
          <div key={key} className="rounded-md border bg-background p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold">
              {overview[key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Order, revenue, pickup, progress, and task metrics are placeholders
        until the order API is connected.
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
