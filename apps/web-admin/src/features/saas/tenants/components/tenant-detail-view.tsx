"use client";

import { Badge, Button, Input, Label, toast } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";

import {
  updateTenantAction,
  updateTenantStatusAction,
} from "../actions";
import { tenantStatusLabels } from "../constants";
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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getOptionalValue(value: string | null | undefined): string {
  return value?.trim() || "Not set";
}

function getStatusActionLabel(status: TenantStatus): string {
  if (status === "active") {
    return "Activate";
  }

  if (status === "suspended") {
    return "Suspend";
  }

  return "Disable";
}

export function TenantDetailView({ tenantId }: TenantDetailViewProps) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<TenantStatus | null>(
    null,
  );

  async function handleUpdateTenant(values: TenantFormValues) {
    const tenantResult = await updateTenantAction(tenantId, values);

    if (!tenantResult.ok) {
      return tenantResult;
    }

    return tenantResult;
  }

  async function handleUpdateStatus(status: TenantStatus) {
    setStatusSubmitting(status);
    setStatusError(null);

    const result = await updateTenantStatusAction(tenantId, {
      reason: statusReason,
      status,
    });

    if (!result.ok) {
      const message =
        result.errors.reason ??
        result.message ??
        "Tenant status update failed.";
      setStatusError(message);
      toast.error(message);
      setStatusSubmitting(null);
      return;
    }

    setTenant(result.data);
    setStatusReason("");
    toast.success(`Tenant status updated to ${tenantStatusLabels[status]}.`);
    setStatusSubmitting(null);
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
        <div className="min-w-0">
          <Badge variant="secondary">Tenant detail</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {tenant?.name ?? "Tenant Detail"}
          </h1>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            {tenant?.id ?? tenantId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tenant ? (
            <Button asChild variant="outline">
              <Link
                href={`${webAdminRoutes.saas.tenants}/${tenant.id}/settings`}
              >
                Settings
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={webAdminRoutes.saas.tenants}>Back to tenants</Link>
          </Button>
        </div>
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

          <div className="grid gap-3 border-b p-5 lg:grid-cols-3">
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Country
              </p>
              <p className="mt-2 font-semibold">
                {getOptionalValue(tenant.country)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                City
              </p>
              <p className="mt-2 font-semibold">
                {getOptionalValue(tenant.city)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default currency
              </p>
              <p className="mt-2 font-semibold">{tenant.defaultCurrency}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contact name
              </p>
              <p className="mt-2 font-semibold">
                {getOptionalValue(tenant.contactName)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contact phone
              </p>
              <p className="mt-2 font-semibold">
                {getOptionalValue(tenant.contactPhone)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contact email
              </p>
              <p className="mt-2 break-all font-semibold">
                {getOptionalValue(tenant.contactEmail)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Created at
              </p>
              <p className="mt-2 font-semibold">
                {formatDate(tenant.createdAt)}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Updated at
              </p>
              <p className="mt-2 font-semibold">
                {formatDate(tenant.updatedAt)}
              </p>
            </div>
          </div>

          <section className="grid gap-4 border-b p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Tenant Status
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Status changes require a reason for the audit trail.
              </p>
            </div>

            {statusError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {statusError}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-2">
                <Label htmlFor="tenant-status-reason">Reason</Label>
                <Input
                  disabled={Boolean(statusSubmitting)}
                  id="tenant-status-reason"
                  onChange={(event) => {
                    setStatusReason(event.target.value);
                    setStatusError(null);
                  }}
                  placeholder="Required for audit log"
                  value={statusReason}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["active", "suspended", "disabled"] as const)
                  .filter((status) => status !== tenant.status)
                  .map((status) => (
                    <Button
                      disabled={Boolean(statusSubmitting)}
                      key={status}
                      onClick={() => {
                        void handleUpdateStatus(status);
                      }}
                      type="button"
                      variant={status === "active" ? "default" : "outline"}
                    >
                      {statusSubmitting === status
                        ? "Updating..."
                        : getStatusActionLabel(status)}
                    </Button>
                  ))}
              </div>
            </div>
          </section>

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
      ) : (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">Tenant not found</h2>
            <p className="text-sm text-muted-foreground">
              The requested tenant could not be loaded.
            </p>
            <div>
              <Button asChild variant="outline">
                <Link href={webAdminRoutes.saas.tenants}>Back to tenants</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
