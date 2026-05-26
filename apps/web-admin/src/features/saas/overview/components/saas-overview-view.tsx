"use client";

import { Badge, Button } from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { getSaasOverviewQuery } from "../queries";
import type { SaasOverview } from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load platform overview.";
}

export function SaasOverviewView() {
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
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, []);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS platform</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Platform Overview
          </h1>
        </div>

        <Button onClick={loadOverview} type="button" variant="outline">
          Refresh
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
          {(
            [
              ["Tenants", overview.tenantCount],
              ["Active tenants", overview.activeTenantCount],
              ["Suspended tenants", overview.suspendedTenantCount],
              ["Branches", overview.branchCount],
              ["Today's orders", overview.todayOrderCount],
              ["Today's revenue", overview.todayRevenueAmount],
              ["Pending feedback", overview.pendingFeedbackCount],
            ] as const
          ).map(([label, value]) => (
            <div className="rounded-md border bg-background p-4" key={label}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
