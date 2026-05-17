"use client";

import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import { tenantStatusLabels } from "../constants";
import { updateTenantAction, updateTenantSettingsAction } from "../actions";
import { getTenantDetailQuery } from "../queries";
import type { TenantDetail, TenantFormValues, TenantStatus } from "../types";
import { TenantForm } from "./tenant-form";

type TenantDetailViewProps = {
  tenantId: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load tenant.";
}

function toFormValues(tenant: TenantDetail): TenantFormValues {
  return {
    name: tenant.name,
    pressingCode: tenant.pressingCode,
    country: tenant.country ?? "",
    city: tenant.city ?? "",
    defaultLanguage: tenant.defaultLanguage ?? "en",
    defaultCurrency: tenant.defaultCurrency ?? "XOF",
    contactName: tenant.contactName ?? "",
    contactPhone: tenant.contactPhone ?? "",
    contactEmail: tenant.contactEmail ?? "",
  };
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

export function TenantDetailView({ tenantId }: TenantDetailViewProps) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdateTenant(values: TenantFormValues) {
    const tenantResult = await updateTenantAction(tenantId, values);

    if (!tenantResult.ok) {
      return tenantResult;
    }

    const settingsResult = await updateTenantSettingsAction(tenantId, values);

    if (!settingsResult.ok) {
      return settingsResult;
    }

    return {
      ok: true as const,
      data: {
        ...tenantResult.data,
        defaultLanguage: settingsResult.data.defaultLanguage,
        defaultCurrency: settingsResult.data.defaultCurrency,
      },
    };
  }

  useEffect(() => {
    let isCurrent = true;

    getTenantDetailQuery(tenantId)
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setTenant(data);
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
  }, [tenantId]);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant detail</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {tenant?.name ?? "Tenant Detail"}
          </h1>
        </div>

        <Button asChild variant="outline">
          <Link href={webAdminRoutes.saas.tenants}>Back to tenants</Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 p-5">
          <div className="h-24 animate-pulse rounded-md bg-muted" />
          <div className="h-80 animate-pulse rounded-md bg-muted" />
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : tenant ? (
        <>
          <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pressing code
              </p>
              <p className="mt-2 font-semibold">{tenant.pressingCode}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <Badge className="mt-2" variant={getStatusVariant(tenant.status)}>
                {tenantStatusLabels[tenant.status]}
              </Badge>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default language
              </p>
              <p className="mt-2 font-semibold">{tenant.defaultLanguage}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Users
              </p>
              <p className="mt-2 font-semibold">{tenant.userCount ?? 0}</p>
            </div>
          </div>

          <TenantForm
            initialValues={toFormValues(tenant)}
            key={`${tenant.id}-${tenant.updatedAt}`}
            mode="edit"
            onSubmit={handleUpdateTenant}
            onSuccess={(updatedTenant) => {
              setTenant(updatedTenant);
            }}
          />
        </>
      ) : null}
    </section>
  );
}
