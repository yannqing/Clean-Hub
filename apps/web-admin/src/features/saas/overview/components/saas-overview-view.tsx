"use client";

import { Badge, Button } from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { useSaasI18n } from "@/i18n";

import { getSaasOverviewQuery } from "../queries";
import type { SaasOverview } from "../types";

export function SaasOverviewView() {
  const { m } = useSaasI18n();
  const [overview, setOverview] = useState<SaasOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSaasOverviewQuery();
      setOverview(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : m.overview.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [m.overview.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getSaasOverviewQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setOverview(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : m.overview.loadError,
          );
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
  }, [m.overview.loadError]);

  const metricItems = overview
    ? ([
        ["tenants", overview.tenantCount],
        ["activeTenants", overview.activeTenantCount],
        ["suspendedTenants", overview.suspendedTenantCount],
        ["branches", overview.branchCount],
        ["todayOrders", overview.todayOrderCount],
        ["todayRevenue", overview.todayRevenueAmount],
        ["pendingFeedback", overview.pendingFeedbackCount],
      ] as const)
    : [];

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.overview.badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {m.overview.title}
          </h1>
        </div>

        <Button onClick={loadOverview} type="button" variant="outline">
          {m.common.refresh}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <div className="h-24 animate-pulse rounded-md bg-muted" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : overview ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {metricItems.map(([key, value]) => (
            <div className="rounded-md border bg-background p-4" key={key}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.overview.metrics[key]}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
