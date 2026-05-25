"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@cleanhub/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { getSaasOverviewQuery } from "../queries";
import type { SaasOverview } from "../types";

const emptyOverview: SaasOverview = {
  tenantCount: 0,
  activeTenantCount: 0,
  suspendedTenantCount: 0,
  branchCount: 0,
  todayOrderCount: 0,
  todayRevenueAmount: 0,
  pendingFeedbackCount: 0,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load overview.";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SaasOverviewView() {
  const [overview, setOverview] = useState<SaasOverview>(emptyOverview);
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
        if (!isCurrent) return;
        setOverview(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const stats = [
    { label: "Total Tenants", value: overview.tenantCount },
    { label: "Active", value: overview.activeTenantCount },
    { label: "Suspended", value: overview.suspendedTenantCount },
    { label: "Branches", value: overview.branchCount },
    { label: "Today Orders", value: overview.todayOrderCount },
    {
      label: "Today Revenue",
      value: formatCurrency(overview.todayRevenueAmount),
    },
    { label: "Pending Feedback", value: overview.pendingFeedbackCount },
  ];

  const quickLinks = [
    { label: "Tenant Management", href: webAdminRoutes.saas.tenants },
    { label: "SaaS Users", href: webAdminRoutes.saas.users },
    { label: "Audit Logs", href: webAdminRoutes.saas.auditLogs },
    {
      label: "Platform Settings",
      href: webAdminRoutes.saas.config.platformSettings,
    },
  ];

  return (
    <section className="p-6">
      <div className="max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="secondary">SaaS Admin</Badge>
            <h1 className="mt-4 text-2xl font-semibold">Platform Overview</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Platform-level administration for tenants, SaaS users, audit logs,
              and global configuration.
            </p>
          </div>
          <Button onClick={loadOverview} type="button" variant="outline">
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value }) => (
            <Card className="rounded-lg" key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-2xl font-semibold">{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Quick Access
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map(({ label, href }) => (
              <Button asChild key={label} variant="outline">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
