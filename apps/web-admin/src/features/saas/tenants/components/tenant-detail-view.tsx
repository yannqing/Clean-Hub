"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@cleanhub/ui";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";
import { webAdminApi } from "@/lib/api-client";
import {
  canOffboardTenant,
  canUpdateTenantStatus,
  canWriteTenant,
} from "@/lib/permissions";

import {
  offboardTenantAction,
  restoreTenantAction,
  updateTenantAction,
  updateTenantStatusAction,
} from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantDefaultValues } from "../constants";
import { getTenantDetailQuery, getTenantUsersQuery } from "../queries";
import type { SaasTenantUserSummary, TenantDetail, TenantFormValues, TenantStatus } from "../types";
import { TenantForm } from "./tenant-form";
import { TenantTaxSettingsCard } from "./tenant-tax-settings-card";

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
  const { locale, m, formatDate } = useSaasI18n();
  const readinessCopy = locale === "zh-CN"
    ? { title: "开店就绪检查", owner: "店主账号", branch: "营业门店", catalog: "商品或服务", terminal: "已绑定终端", tax: "已启用税务", taxTemplate: "已应用当前国家税务模板", taxNumber: "税务登记号" }
    : locale === "fr"
      ? { title: "Préparation du magasin", owner: "Compte propriétaire", branch: "Magasin actif", catalog: "Produit ou service", terminal: "Terminal inscrit", tax: "Taxe activée", taxTemplate: "Modèle fiscal national actuel appliqué", taxNumber: "Numéro fiscal" }
      : { title: "Store readiness", owner: "Owner account", branch: "Active branch", catalog: "Product or service", terminal: "Enrolled terminal", tax: "Tax enabled", taxTemplate: "Current country tax template applied", taxNumber: "Tax registration number" };
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [tenantUsers, setTenantUsers] = useState<SaasTenantUserSummary[] | null>(null);
  const [tenantUsersError, setTenantUsersError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<TenantStatus | null>(
    null,
  );
  const [offboardReason, setOffboardReason] = useState("");
  const [offboardError, setOffboardError] = useState<string | null>(null);
  const [offboardSubmitting, setOffboardSubmitting] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canManageTenant = canWriteTenant(authContext);
  const canManageStatus = canUpdateTenantStatus(authContext);
  const canManageOffboarding = canOffboardTenant(authContext);

  /**
   * Download the export straight from the browser.
   *
   * Deliberately not a Server Action: the archive can be megabytes, and routing
   * it through one would buffer the whole thing twice on the server.
   */
  async function handleExport() {
    setExporting(true);

    try {
      const blob = await webAdminApi.saas.tenants.exportArchive(tenantId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tenant?.pressingCode ?? tenantId}-export.zip`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Release on the next tick so the click has time to fire.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success(m.tenants.detail.exportSucceeded);
    } catch {
      toast.error(m.tenants.detail.exportFailed);
    }

    setExporting(false);
  }

  async function handleOffboard() {
    if (!window.confirm(m.tenants.detail.offboardConfirm)) {
      return;
    }

    setOffboardSubmitting(true);
    setOffboardError(null);

    const result = await offboardTenantAction(tenantId, {
      reason: offboardReason,
    });

    if (!result.ok) {
      const message =
        result.errors.reason ??
        result.message ??
        m.tenants.detail.offboardFailed;
      setOffboardError(message);
      toast.error(message);
      setOffboardSubmitting(false);
      return;
    }

    setTenant(result.data);
    setOffboardReason("");
    onTenantUpdated?.();
    toast.success(
      interpolate(m.tenants.detail.offboardSucceeded, {
        tables: String(result.exportedTables),
      }),
    );
    setOffboardSubmitting(false);
  }

  async function handleRestore() {
    setRestoreSubmitting(true);
    setOffboardError(null);

    const result = await restoreTenantAction(tenantId, {
      reason: offboardReason,
    });

    if (!result.ok) {
      const message =
        result.errors.reason ??
        result.message ??
        m.tenants.detail.restoreFailed;
      setOffboardError(message);
      toast.error(message);
      setRestoreSubmitting(false);
      return;
    }

    setTenant(result.data);
    setOffboardReason("");
    onTenantUpdated?.();
    toast.success(m.tenants.detail.restoreSucceeded);
    setRestoreSubmitting(false);
  }
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

    Promise.allSettled([getCurrentAuthQuery(), getTenantDetailQuery(tenantId), getTenantUsersQuery(tenantId)])
      .then(([authResult, tenantResult, usersResult]) => {
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
        if (usersResult.status === "fulfilled") {
          setTenantUsers(usersResult.value);
          setTenantUsersError(false);
        } else {
          setTenantUsers(null);
          setTenantUsersError(true);
        }
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
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
      <SaasBreadcrumbs
        ariaLabel={m.tenants.detail.title}
        className="flex-1"
        items={[{ label: tenant?.name ?? m.tenants.detail.title }]}
        rootHref={webAdminRoutes.saas.tenants}
        rootIcon={Building2}
        rootLabel={m.tenants.list.title}
      />
      {tenant ? (
        <Button asChild size="sm" variant="outline">
          <Link href={webAdminRoutes.saas.tenantSettings(tenant.id)}>
            {m.tenants.detail.settings}
          </Link>
        </Button>
      ) : null}
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
          <Button
            onClick={onOpenSettings}
            size="sm"
            type="button"
            variant="outline"
          >
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
        <div
          aria-busy="true"
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"
        >
          <div className="grid gap-5">
            <div className="h-56 animate-pulse rounded-lg border bg-muted/70" />
            <div className="h-44 animate-pulse rounded-lg border bg-muted/70" />
          </div>
          <div className="h-80 animate-pulse rounded-lg border bg-muted/70" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : tenant ? (
        <div className="grid gap-3">
          {authError || !canManageTenant ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {authError
                ? `${m.tenants.detail.sessionError} ${authError}`
                : m.tenants.detail.readOnlyHint}
            </div>
          ) : null}

          <TenantForm
            disabled={!canManageTenant}
            initialValues={toFormValues(tenant)}
            key={`${tenant.id}-${tenant.updatedAt}`}
            mode="edit"
            aside={
              <>
                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">
                          {tenant.name}
                        </h2>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {tenant.id}
                        </p>
                      </div>
                      <Badge
                        className="shrink-0"
                        variant={getStatusVariant(tenant.status)}
                      >
                        {m.common.statusLabels[tenant.status]}
                      </Badge>
                    </div>

                    <dl className="divide-y text-sm">
                      <div className="grid gap-1 py-2 first:pt-0">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.pressingCode}
                        </dt>
                        <dd className="break-all font-medium">
                          {tenant.pressingCode}
                        </dd>
                      </div>
                      <div className="grid gap-1 py-2">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.defaultLanguage}
                        </dt>
                        <dd className="font-medium">
                          {tenant.defaultLanguage}
                        </dd>
                      </div>
                      <div className="grid gap-1 py-2">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.defaultCurrency}
                        </dt>
                        <dd className="font-medium">
                          {tenant.defaultCurrency}
                        </dd>
                      </div>
                      <div className="grid gap-1 py-2">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.users}
                        </dt>
                        <dd className="font-medium">{tenant.userCount ?? 0}</dd>
                      </div>
                      <div className="grid gap-1 py-2">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.createdAt}
                        </dt>
                        <dd className="font-medium">
                          {formatDate(tenant.createdAt) || m.common.invalidDate}
                        </dd>
                      </div>
                      <div className="grid gap-1 py-2 last:pb-0">
                        <dt className="text-xs text-muted-foreground">
                          {m.tenants.detail.fields.updatedAt}
                        </dt>
                        <dd className="font-medium">
                          {formatDate(tenant.updatedAt) || m.common.invalidDate}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-3 py-5">
                    <div>
                      <h2 className="text-sm font-semibold">{m.tenants.detail.tenantUsersTitle}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{m.tenants.detail.tenantUsersHint}</p>
                    </div>
                    {tenantUsersError ? (
                      <p className="text-xs text-destructive">{m.tenants.detail.tenantUsersLoadError}</p>
                    ) : tenantUsers === null ? (
                      <p className="text-xs text-muted-foreground">{m.tenants.detail.tenantUsersLoading}</p>
                    ) : tenantUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{m.tenants.detail.tenantUsersEmpty}</p>
                    ) : (
                      <ul className="max-h-60 space-y-2 overflow-y-auto">
                        {tenantUsers.map((user) => (
                          <li className="rounded-md border p-2 text-xs" key={user.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium">{user.displayName}</span>
                              {user.roleCodes.includes("owner") ? <Badge variant="secondary">{locale === "zh-CN" ? "店主" : locale === "fr" ? "Propriétaire" : "Owner"}</Badge> : null}
                            </div>
                            <p className="mt-1 break-all text-muted-foreground">{user.email ?? user.phone ?? user.id}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <TenantTaxSettingsCard
                  canEdit={authContext?.role === "super_admin"}
                  key={`${tenant.id}-${tenant.updatedAt}`}
                  onSaved={() => { void getTenantDetailQuery(tenantId).then(setTenant); }}
                  templateApplied={tenant.readiness.taxTemplateApplied}
                  tenantId={tenantId}
                />

                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-3 py-5">
                    <h2 className="text-sm font-semibold">{readinessCopy.title}</h2>
                    {([
                      [readinessCopy.owner, tenant.readiness.activeOwnerCount > 0, tenant.readiness.activeOwnerCount],
                      [readinessCopy.branch, tenant.readiness.activeBranchCount > 0, tenant.readiness.activeBranchCount],
                      [readinessCopy.catalog, tenant.readiness.activeCatalogItemCount > 0, null],
                      [readinessCopy.terminal, tenant.readiness.enrolledTerminalCount > 0, tenant.readiness.enrolledTerminalCount],
                      [readinessCopy.tax, tenant.readiness.taxEnabled, null],
                      [readinessCopy.taxTemplate, tenant.readiness.taxTemplateApplied, null],
                      [readinessCopy.taxNumber, tenant.readiness.taxRegistrationNumberSet, null],
                    ] as const).map(([label, ready, count]) => (
                      <div className="flex items-center justify-between gap-3 text-sm" key={label}>
                        <span>{label}{count === null ? "" : ` (${count})`}</span>
                        <Badge variant={ready ? "default" : "secondary"}>{ready ? "✓" : "—"}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {m.tenants.detail.statusSection}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {m.tenants.detail.statusReasonHint}
                      </p>
                    </div>

                    {statusError ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {statusError}
                      </div>
                    ) : null}

                    {!canManageStatus ? (
                      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        {m.tenants.detail.statusPermissionHint}
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <Label htmlFor="tenant-status-reason">
                        {m.tenants.detail.reason}
                      </Label>
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

                    <div className="grid gap-2">
                      {(["active", "suspended", "disabled"] as const)
                        .filter((status) => status !== tenant.status)
                        .map((status) => (
                          <Button
                            className="w-full"
                            disabled={
                              !canManageStatus || Boolean(statusSubmitting)
                            }
                            key={status}
                            onClick={() => {
                              void handleUpdateStatus(status);
                            }}
                            size="sm"
                            type="button"
                            variant={
                              status === "active" ? "default" : "outline"
                            }
                          >
                            {statusSubmitting === status
                              ? m.common.updating
                              : getStatusActionLabel(status, m)}
                          </Button>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-4 py-5">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {m.tenants.detail.offboardSection}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {m.tenants.detail.offboardHint}
                      </p>
                    </div>

                    {tenant.offboarding ? (
                      <div className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        <span>
                          {interpolate(m.tenants.detail.offboardedBanner, {
                            date: formatDate(tenant.offboarding.offboardedAt),
                            reason: tenant.offboarding.offboardReason,
                          })}
                        </span>
                        <span>
                          {interpolate(m.tenants.detail.purgeAfterLabel, {
                            date: formatDate(tenant.offboarding.purgeAfter),
                          })}
                        </span>
                      </div>
                    ) : null}

                    {offboardError ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {offboardError}
                      </div>
                    ) : null}

                    {!canManageOffboarding ? (
                      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        {m.tenants.detail.offboardPermissionHint}
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <Label htmlFor="tenant-offboard-reason">
                        {m.tenants.detail.reason}
                      </Label>
                      <Input
                        disabled={
                          !canManageOffboarding ||
                          offboardSubmitting ||
                          restoreSubmitting
                        }
                        id="tenant-offboard-reason"
                        onChange={(event) => {
                          setOffboardReason(event.target.value);
                          setOffboardError(null);
                        }}
                        placeholder={m.tenants.detail.reasonPlaceholder}
                        value={offboardReason}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Button
                        className="w-full"
                        disabled={!canManageOffboarding || exporting}
                        onClick={() => {
                          void handleExport();
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {exporting
                          ? m.common.updating
                          : m.tenants.detail.exportAction}
                      </Button>

                      {tenant.offboarding ? (
                        <Button
                          className="w-full"
                          disabled={!canManageOffboarding || restoreSubmitting}
                          onClick={() => {
                            void handleRestore();
                          }}
                          size="sm"
                          type="button"
                          variant="default"
                        >
                          {restoreSubmitting
                            ? m.common.updating
                            : m.tenants.detail.restoreAction}
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={!canManageOffboarding || offboardSubmitting}
                          onClick={() => {
                            void handleOffboard();
                          }}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {offboardSubmitting
                            ? m.common.updating
                            : m.tenants.detail.offboardAction}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            }
            onSubmit={handleUpdateTenant}
            onSuccess={(updatedTenant) => {
              setTenant(updatedTenant);
              onTenantUpdated?.();
            }}
          />
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed p-8 text-center">
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
      )}
    </>
  );

  if (isDialog) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {pageHeader}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{body}</div>
      </div>
    );
  }

  return (
    <section className="mx-auto min-h-[560px] w-full max-w-[960px] space-y-3 pb-20">
      <h1 className="sr-only">{tenant?.name ?? m.tenants.detail.title}</h1>
      {pageHeader}
      {body}
    </section>
  );
}
