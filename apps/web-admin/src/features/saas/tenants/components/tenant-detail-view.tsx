"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";
import {
  canUpdateTenantStatus,
  canWriteTenant,
} from "@/lib/permissions";

import { updateTenantAction, updateTenantStatusAction } from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantDefaultValues } from "../constants";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { getTenantDetailQuery } from "../queries";
import type { TenantDetail, TenantFormValues, TenantStatus } from "../types";
import { TenantForm } from "./tenant-form";

export type TenantDetailPresentation = "page" | "dialog";

export type TenantDetailViewProps = {
  tenantId: string;
  presentation?: TenantDetailPresentation;
  onOpenSettings?: () => void;
  onTenantUpdated?: () => void;
};

function toFormValues(tenant: TenantDetail): TenantFormValues {
  return {
    ...tenantDefaultValues,
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

function getStatusActionLabel(
  status: TenantStatus,
  m: ReturnType<typeof useSaasI18n>["m"],
): string {
  if (status === "active") {
    return m.tenants.detail.activate;
  }

  if (status === "suspended") {
    return m.tenants.detail.suspend;
  }

  return m.tenants.detail.disable;
}

export function TenantDetailView({
  tenantId,
  presentation = "page",
  onOpenSettings,
  onTenantUpdated,
}: TenantDetailViewProps) {
  const isDialog = presentation === "dialog";
  const { m, formatDate } = useSaasI18n();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<TenantStatus | null>(
    null,
  );
  const canManageTenant = canWriteTenant(authContext);
  const canManageStatus = canUpdateTenantStatus(authContext);
  async function handleUpdateTenant(values: TenantFormValues) {
    const tenantResult = await updateTenantAction(tenantId, values);

    if (!tenantResult.ok) {
      return tenantResult;
    }

    return tenantResult;
  }

  async function handleUpdateStatus(status: TenantStatus) {
    if (!canManageStatus) {
      const message = m.tenants.detail.statusPermissionError;
      setStatusError(message);
      toast.error(message);
      return;
    }

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
        m.tenants.detail.statusUpdateFailed;
      setStatusError(message);
      toast.error(message);
      setStatusSubmitting(null);
      return;
    }

    setTenant(result.data);
    setStatusReason("");
    onTenantUpdated?.();
    toast.success(
      interpolate(m.tenants.detail.statusUpdated, {
        status: m.common.statusLabels[status],
      }),
    );
    setStatusSubmitting(null);
  }

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([
      getCurrentAuthQuery(),
      getTenantDetailQuery(tenantId),
    ])
      .then(([authResult, tenantResult]) => {
        if (!isCurrent) {
          return;
        }

        if (authResult.status === "fulfilled") {
          setAuthContext(authResult.value);
          setAuthError(null);
        } else {
          setAuthContext(null);
          setAuthError(
            getTenantLoadErrorMessage(
              authResult.reason,
              m.tenants.detail.sessionError,
            ),
          );
        }

        if (tenantResult.status === "rejected") {
          throw tenantResult.reason;
        }

        setTenant(tenantResult.value);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(
            getTenantLoadErrorMessage(loadError, m.tenants.detail.loadError),
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
  }, [m.tenants.detail.loadError, m.tenants.detail.sessionError, tenantId]);

  const pageHeader = !isDialog ? (
    <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Badge variant="secondary">{m.tenants.detail.badge}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {tenant?.name ?? m.tenants.detail.title}
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
              {m.tenants.detail.settings}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={webAdminRoutes.saas.tenants}>
            {m.tenants.detail.backToTenants}
          </Link>
        </Button>
      </div>
    </div>
  ) : (
    <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <DialogTitle className="text-lg">
            {tenant?.name ?? m.tenants.detail.title}
          </DialogTitle>
          <p className="break-all text-sm text-muted-foreground">
            {tenant?.id ?? tenantId}
          </p>
        </div>
        {tenant && onOpenSettings ? (
          <Button onClick={onOpenSettings} size="sm" type="button" variant="outline">
            {m.tenants.detail.settings}
          </Button>
        ) : null}
      </div>
      <DialogDescription className="sr-only">
        {m.tenants.detail.title}
      </DialogDescription>
    </DialogHeader>
  );

  const body = (
    <>
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
                {m.tenants.detail.fields.pressingCode}
              </p>
              <p className="mt-2 font-semibold">{tenant.pressingCode}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.status}
              </p>
              <Badge className="mt-2" variant={getStatusVariant(tenant.status)}>
                {m.common.statusLabels[tenant.status]}
              </Badge>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.defaultLanguage}
              </p>
              <p className="mt-2 font-semibold">{tenant.defaultLanguage}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.users}
              </p>
              <p className="mt-2 font-semibold">{tenant.userCount ?? 0}</p>
            </div>
          </div>

          <div className="grid gap-3 border-b p-5 lg:grid-cols-3">
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.country}
              </p>
              <p className="mt-2 font-semibold">
                {tenant.country?.trim() || m.common.notSet}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.city}
              </p>
              <p className="mt-2 font-semibold">
                {tenant.city?.trim() || m.common.notSet}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.defaultCurrency}
              </p>
              <p className="mt-2 font-semibold">{tenant.defaultCurrency}</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.contactName}
              </p>
              <p className="mt-2 font-semibold">
                {tenant.contactName?.trim() || m.common.notSet}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.contactPhone}
              </p>
              <p className="mt-2 font-semibold">
                {tenant.contactPhone?.trim() || m.common.notSet}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.contactEmail}
              </p>
              <p className="mt-2 break-all font-semibold">
                {tenant.contactEmail?.trim() || m.common.notSet}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.createdAt}
              </p>
              <p className="mt-2 font-semibold">
                {formatDate(tenant.createdAt) || m.common.invalidDate}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.tenants.detail.fields.updatedAt}
              </p>
              <p className="mt-2 font-semibold">
                {formatDate(tenant.updatedAt) || m.common.invalidDate}
              </p>
            </div>
          </div>

          <section className="grid gap-4 border-b p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {m.tenants.detail.statusSection}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {m.tenants.detail.statusReasonHint}
              </p>
            </div>

            {statusError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {statusError}
              </div>
            ) : null}

            {!canManageStatus ? (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                {m.tenants.detail.statusPermissionHint}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-2">
                <Label htmlFor="tenant-status-reason">{m.tenants.detail.reason}</Label>
                <Input
                  disabled={!canManageStatus || Boolean(statusSubmitting)}
                  id="tenant-status-reason"
                  onChange={(event) => {
                    setStatusReason(event.target.value);
                    setStatusError(null);
                  }}
                  placeholder={m.tenants.detail.reasonPlaceholder}
                  value={statusReason}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["active", "suspended", "disabled"] as const)
                  .filter((status) => status !== tenant.status)
                  .map((status) => (
                    <Button
                      disabled={!canManageStatus || Boolean(statusSubmitting)}
                      key={status}
                      onClick={() => {
                        void handleUpdateStatus(status);
                      }}
                      type="button"
                      variant={status === "active" ? "default" : "outline"}
                    >
                      {statusSubmitting === status
                        ? m.common.updating
                        : getStatusActionLabel(status, m)}
                    </Button>
                  ))}
              </div>
            </div>
          </section>

          {authError || !canManageTenant ? (
            <div className="mx-5 mt-5 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              {authError
                ? `Tenant editing is read-only because the current session could not be verified: ${authError}`
                : m.tenants.detail.readOnlyHint}
            </div>
          ) : null}

          <TenantForm
            disabled={!canManageTenant}
            initialValues={toFormValues(tenant)}
            key={`${tenant.id}-${tenant.updatedAt}`}
            mode="edit"
            onSubmit={handleUpdateTenant}
            onSuccess={(updatedTenant) => {
              setTenant(updatedTenant);
              onTenantUpdated?.();
            }}
          />
        </>
      ) : (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">
              {m.tenants.detail.notFoundTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.tenants.detail.notFoundDescription}
            </p>
            {!isDialog ? (
              <div>
                <Button asChild variant="outline">
                  <Link href={webAdminRoutes.saas.tenants}>
                    {m.tenants.detail.backToTenants}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );

  if (isDialog) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {pageHeader}
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </div>
    );
  }

  return (
    <section className="min-h-[560px]">
      {pageHeader}
      {body}
    </section>
  );
}
