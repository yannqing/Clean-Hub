"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { formatMoney } from "@/lib/format";
import { useTenantI18n } from "@/i18n";

import { BRANCH_LIST_LIMIT, getBranchListQuery } from "../../branches/queries";
import { getTenantOverviewQuery } from "../queries";
import type { TenantOverview } from "../types";

const metricKeys = [
  "todayOrderCount",
  "todayRevenueAmount",
  "pendingPickupCount",
  "inProgressOrderCount",
  "pendingTasksCount",
] as const;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  const { m } = useTenantI18n();
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

  const metricLabels = useMemo(
    () => ({
      todayOrderCount: m.overview.metrics.todayOrders,
      todayRevenueAmount: m.overview.metrics.todayRevenue,
      pendingPickupCount: m.overview.metrics.pendingPickup,
      inProgressOrderCount: m.overview.metrics.inProgress,
      pendingTasksCount: m.overview.metrics.pendingTasks,
    }),
    [m.overview.metrics],
  );

  const quickLinks = useMemo(
    () =>
      [
        {
          label: m.overview.quickLinks.createBranch,
          href: `${webAdminRoutes.tenant.branches}/new`,
        },
        {
          label: m.overview.quickLinks.settings,
          href: webAdminRoutes.tenant.system.settings,
        },
        {
          label: m.overview.quickLinks.branches,
          href: webAdminRoutes.tenant.branches,
        },
        {
          label: m.overview.quickLinks.services,
          href: webAdminRoutes.tenant.services,
        },
        {
          label: m.overview.quickLinks.prices,
          href: webAdminRoutes.tenant.prices,
        },
        {
          label: m.overview.quickLinks.reports,
          href: webAdminRoutes.tenant.reports,
        },
      ] as const,
    [m.overview.quickLinks],
  );

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
      setErrorMessage(getErrorMessage(error, m.overview.requestFailed));
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
        setErrorMessage(getErrorMessage(error, m.overview.requestFailed));
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [initialOverview, m.overview.requestFailed]);

  if (loading) {
    return (
      <section className="grid gap-5 p-5">
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-5">
          {metricKeys.map((key) => (
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
          <span>{errorMessage ?? m.overview.unavailable}</span>
          <Button
            onClick={loadOverview}
            size="sm"
            type="button"
            variant="outline"
          >
            {m.common.retry}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.overview.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {overview.tenantName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.overview.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{overview.tenantStatus}</Badge>
          <Badge variant="outline">
            {enabledFeatureCount} {m.overview.featuresEnabled}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">
            {m.overview.metrics.visibleBranches}
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {branchCountReachedLimit
              ? `${branchCount} ${m.overview.metrics.shown}`
              : (branchCount?.toLocaleString() ??
                m.overview.metrics.unavailable)}
          </p>
        </div>
        {metricKeys.map((key) => (
          <div key={key} className="rounded-md border bg-background p-4">
            <p className="text-sm text-muted-foreground">{metricLabels[key]}</p>
            <p className="mt-3 text-2xl font-semibold">
              {key === "todayRevenueAmount"
                ? formatMoney(overview[key], overview.currency)
                : overview[key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <h2 className="text-base font-semibold">{m.overview.quickActions}</h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Button asChild key={link.href} variant="outline">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
