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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { Building2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasBreadcrumbs } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";
import { canUpdateTenantStatus, canWriteTenant } from "@/lib/permissions";

import {
  updateTenantSettingsAction,
  updateTenantStatusAction,
} from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import { tenantFeatureFlagOptions, tenantLanguageOptions } from "../constants";
import { toFeatureFlagsFormValues } from "../feature-flags";
import {
  getTenantDetailQuery,
  getTenantFeatureFlagsQuery,
  getTenantSettingsQuery,
} from "../queries";
import type {
  TenantDetail,
  TenantFeatureFlags,
  TenantSettings,
  TenantSettingsFormValues,
  TenantStatus,
} from "../types";
import { TenantIdentitySummary } from "./tenant-identity-summary";
import { TenantFeatureFlagsEditor } from "./tenant-feature-flags-editor";

export type TenantSettingsPresentation = "page" | "dialog";

export type TenantSettingsViewProps = {
  tenantId: string;
  presentation?: TenantSettingsPresentation;
  onTenantUpdated?: () => void;
};

type TenantSettingsLoadResults = readonly [
  PromiseSettledResult<AuthContext>,
  PromiseSettledResult<TenantDetail>,
  PromiseSettledResult<TenantSettings>,
  PromiseSettledResult<TenantFeatureFlags>,
];

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

function toSettingsFormValues(
  settings: TenantSettings,
): TenantSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
  };
}

function SettingsSummary({
  tenant,
  settings,
  featureFlags,
}: {
  tenant: TenantDetail;
  settings: TenantSettings;
  featureFlags: TenantFeatureFlags;
}) {
  const { m } = useSaasI18n();
  const enabledCount = Object.values(
    toFeatureFlagsFormValues(featureFlags),
  ).filter(Boolean).length;

  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{tenant.name}</h2>
            <div className="mt-2"><TenantIdentitySummary tenantId={tenant.id} tenantCode={tenant.pressingCode} /></div>
          </div>
          <Badge className="shrink-0" variant={getStatusVariant(tenant.status)}>
            {m.common.statusLabels[tenant.status]}
          </Badge>
        </div>

        <dl className="divide-y text-sm">
          <div className="grid gap-1 py-2 first:pt-0">
            <dt className="text-xs text-muted-foreground">
              {m.tenants.detail.fields.defaultLanguage}
            </dt>
            <dd className="font-medium">{settings.defaultLanguage}</dd>
          </div>
          <div className="grid gap-1 py-2">
            <dt className="text-xs text-muted-foreground">
              {m.tenants.detail.fields.defaultCurrency}
            </dt>
            <dd className="font-medium">{settings.defaultCurrency}</dd>
          </div>
          <div className="grid gap-1 py-2 last:pb-0">
            <dt className="text-xs text-muted-foreground">
              {m.tenants.settings.enabledFeatures}
            </dt>
            <dd className="font-medium">
              {enabledCount} / {tenantFeatureFlagOptions.length}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function TenantSettingsForm({
  disabled,
  initialValues,
  onUpdated,
  tenantId,
}: {
  disabled: boolean;
  initialValues: TenantSettingsFormValues;
  onUpdated: (settings: TenantSettings) => void;
  tenantId: string;
}) {
  const { locale, m } = useSaasI18n();
  const [values, setValues] = useState<TenantSettingsFormValues>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantSettingsFormValues, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function updateValue(
    key: keyof TenantSettingsFormValues,
    value: string,
  ): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await updateTenantSettingsAction(tenantId, values);

      if (!result.ok) {
        setErrors(result.errors);
        const message = "message" in result ? result.message : undefined;

        toast.error(
          Object.values(result.errors)[0] ??
            message ??
            m.tenants.settings.defaultsSaveFailed,
        );
        return;
      }

      setErrors({});
      setValues(toSettingsFormValues(result.data));
      onUpdated(result.data);
      toast.success(m.tenants.settings.defaultsSaved);
    } catch (error) {
      toast.error(
        getTenantLoadErrorMessage(error, m.tenants.settings.defaultsSaveFailed),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="gap-0 rounded-lg py-0 shadow-none">
        <CardContent className="grid gap-4 py-5">
          <h2 className="text-sm font-semibold">
            {m.tenants.settings.defaultsSection}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tenant-settings-language">
                {m.tenants.detail.fields.defaultLanguage}
              </Label>
              <Select
                disabled={disabled || submitting}
                onValueChange={(value) =>
                  updateValue(
                    "defaultLanguage",
                    value as TenantSettingsFormValues["defaultLanguage"],
                  )
                }
                value={values.defaultLanguage}
              >
                <SelectTrigger className="w-full" id="tenant-settings-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenantLanguageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.defaultLanguage ? (
                <p className="text-xs text-destructive">
                  {errors.defaultLanguage}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenant-settings-currency">
                {m.tenants.detail.fields.defaultCurrency}
              </Label>
              <Input
                aria-invalid={Boolean(errors.defaultCurrency)}
                disabled
                id="tenant-settings-currency"
                maxLength={3}
                value={values.defaultCurrency}
              />
              <p className="text-xs text-muted-foreground">
                {locale === "zh-CN"
                  ? "币种由租户国家的税务模板决定。要更换国家，请在租户详情页操作。"
                  : locale === "fr"
                    ? "La devise suit le modèle fiscal du pays. Changez le pays depuis la fiche du locataire."
                    : "Currency follows the country's tax template. Change the country on the tenant detail page."}
              </p>
              {errors.defaultCurrency ? (
                <p className="text-xs text-destructive">
                  {errors.defaultCurrency}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={disabled || submitting} type="submit">
              {submitting ? m.common.saving : m.tenants.settings.saveDefaults}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function TenantStatusForm({
  disabled,
  onTenantUpdated,
  onUpdated,
  tenant,
}: {
  disabled: boolean;
  onTenantUpdated?: () => void;
  onUpdated: (tenant: TenantDetail) => void;
  tenant: TenantDetail;
}) {
  const { m } = useSaasI18n();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<TenantStatus | null>(null);

  async function handleStatusUpdate(status: TenantStatus) {
    if (disabled) {
      return;
    }

    setSubmitting(status);
    setError(null);

    const result = await updateTenantStatusAction(tenant.id, {
      reason,
      status,
    });

    if (!result.ok) {
      const message =
        result.errors.reason ??
        result.message ??
        m.tenants.detail.statusUpdateFailed;
      setError(message);
      toast.error(message);
      setSubmitting(null);
      return;
    }

    onUpdated(result.data);
    setReason("");
    onTenantUpdated?.();
    toast.success(
      interpolate(m.tenants.detail.statusUpdated, {
        status: m.common.statusLabels[status],
      }),
    );
    setSubmitting(null);
  }

  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-4 py-5">
        <h2 className="text-sm font-semibold">
          {m.tenants.settings.pilotSection}
        </h2>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="tenant-settings-status-reason">
            {m.tenants.detail.reason}
          </Label>
          <Input
            disabled={disabled || Boolean(submitting)}
            id="tenant-settings-status-reason"
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder={m.tenants.detail.reasonPlaceholder}
            value={reason}
          />
        </div>

        <div className="grid gap-2">
          {(["active", "suspended", "disabled"] as const)
            .filter((status) => status !== tenant.status)
            .map((status) => (
              <Button
                className="w-full"
                disabled={disabled || Boolean(submitting)}
                key={status}
                onClick={() => {
                  void handleStatusUpdate(status);
                }}
                size="sm"
                type="button"
                variant={status === "active" ? "default" : "outline"}
              >
                {submitting === status
                  ? m.common.updating
                  : getStatusActionLabel(status, m)}
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TenantSettingsView({
  tenantId,
  presentation = "page",
  onTenantUpdated,
}: TenantSettingsViewProps) {
  const isDialog = presentation === "dialog";
  const { m, formatDateTime } = useSaasI18n();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [featureFlags, setFeatureFlags] = useState<TenantFeatureFlags | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManageTenantSettings = canWriteTenant(authContext);
  const canManageTenantStatus = canUpdateTenantStatus(authContext);

  const applyLoadResults = useCallback(
    ([
      authResult,
      tenantResult,
      settingsResult,
      featureFlagsResult,
    ]: TenantSettingsLoadResults) => {
      if (authResult.status === "fulfilled") {
        setAuthContext(authResult.value);
        setAuthError(null);
      } else {
        setAuthContext(null);
        setAuthError(
          getTenantLoadErrorMessage(
            authResult.reason,
            m.tenants.settings.sessionError,
          ),
        );
      }

      if (tenantResult.status === "rejected") {
        throw tenantResult.reason;
      }

      if (settingsResult.status === "rejected") {
        throw settingsResult.reason;
      }

      if (featureFlagsResult.status === "rejected") {
        throw featureFlagsResult.reason;
      }

      setTenant(tenantResult.value);
      setSettings(settingsResult.value);
      setFeatureFlags(featureFlagsResult.value);
      setError(null);
    },
    [m.tenants.settings.sessionError],
  );

  const loadSettings = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      try {
        const results = await Promise.allSettled([
          getCurrentAuthQuery(),
          getTenantDetailQuery(tenantId),
          getTenantSettingsQuery(tenantId),
          getTenantFeatureFlagsQuery(tenantId),
        ]);

        applyLoadResults(results);
      } catch (loadError) {
        setError(
          getTenantLoadErrorMessage(loadError, m.tenants.settings.loadError),
        );
      } finally {
        setLoading(false);
      }
    },
    [applyLoadResults, m.tenants.settings.loadError, tenantId],
  );

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([
      getCurrentAuthQuery(),
      getTenantDetailQuery(tenantId),
      getTenantSettingsQuery(tenantId),
      getTenantFeatureFlagsQuery(tenantId),
    ])
      .then((results) => {
        if (!isCurrent) {
          return;
        }

        applyLoadResults(results);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(
            getTenantLoadErrorMessage(loadError, m.tenants.settings.loadError),
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
  }, [applyLoadResults, m.tenants.settings.loadError, tenantId]);

  const refreshButton = (
    <Button
      disabled={loading}
      onClick={() => {
        void loadSettings();
      }}
      size={isDialog ? "sm" : undefined}
      type="button"
      variant="outline"
    >
      {m.tenants.settings.refresh}
    </Button>
  );

  const pageHeader = !isDialog ? (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
      <SaasBreadcrumbs
        ariaLabel={m.tenants.settings.title}
        className="flex-1"
        items={[
          {
            href: webAdminRoutes.saas.tenant(tenantId),
            label: tenant?.name ?? m.tenants.detail.title,
          },
          { label: m.tenants.settings.title },
        ]}
        rootHref={webAdminRoutes.saas.tenants}
        rootIcon={Building2}
        rootLabel={m.tenants.list.title}
      />
      {refreshButton}
    </div>
  ) : (
    <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <DialogTitle className="text-lg">
            {tenant?.name ?? m.tenants.settings.title}
          </DialogTitle>
          {tenant ? <TenantIdentitySummary tenantId={tenant.id} tenantCode={tenant.pressingCode} /> : (
            <p className="break-all text-sm text-muted-foreground">{m.tenants.identity.systemId}: {tenantId}</p>
          )}
        </div>
        {refreshButton}
      </div>
      <DialogDescription className="sr-only">
        {m.tenants.settings.title}
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
            <div className="h-48 animate-pulse rounded-lg border bg-muted/70" />
            <div className="h-72 animate-pulse rounded-lg border bg-muted/70" />
          </div>
          <div className="grid gap-5">
            <div className="h-52 animate-pulse rounded-lg border bg-muted/70" />
            <div className="h-60 animate-pulse rounded-lg border bg-muted/70" />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : tenant && settings && featureFlags ? (
        <div className="grid gap-3">
          {authError || !canManageTenantSettings ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {authError
                ? `${m.tenants.settings.sessionError} ${authError}`
                : m.tenants.settings.readOnlyHint}
            </div>
          ) : null}

          {!canManageTenantStatus ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {m.tenants.settings.statusPermissionHint}
            </div>
          ) : null}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <TenantSettingsForm
                disabled={!canManageTenantSettings}
                initialValues={toSettingsFormValues(settings)}
                key={`settings-${settings.tenantId}-${settings.updatedAt ?? "initial"}`}
                onUpdated={(nextSettings) => {
                  setSettings(nextSettings);
                  onTenantUpdated?.();
                }}
                tenantId={tenantId}
              />

              <TenantFeatureFlagsEditor
                disabled={!canManageTenantSettings}
                initialValues={toFeatureFlagsFormValues(featureFlags)}
                key={`flags-${featureFlags.tenantId}-${featureFlags.version}`}
                onUpdated={(nextFlags) => {
                  setFeatureFlags(nextFlags);
                  onTenantUpdated?.();
                }}
                tenantId={tenantId}
              />
            </div>

            <aside className="grid gap-5">
              <SettingsSummary
                featureFlags={featureFlags}
                settings={settings}
                tenant={tenant}
              />

              <TenantStatusForm
                disabled={!canManageTenantStatus}
                key={`${tenant.id}-${tenant.status}-${tenant.updatedAt}`}
                onTenantUpdated={onTenantUpdated}
                onUpdated={setTenant}
                tenant={tenant}
              />

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <h2 className="text-sm font-semibold">
                    {m.tenants.settings.settingsUpdated}
                  </h2>
                  <dl className="divide-y text-sm">
                    <div className="grid gap-1 py-2 first:pt-0">
                      <dt className="text-xs text-muted-foreground">
                        {m.tenants.settings.tenantUpdated}
                      </dt>
                      <dd className="break-words font-medium">
                        {tenant.updatedAt
                          ? formatDateTime(tenant.updatedAt)
                          : m.common.notSet}
                      </dd>
                    </div>
                    <div className="grid gap-1 py-2">
                      <dt className="text-xs text-muted-foreground">
                        {m.tenants.settings.settingsUpdated}
                      </dt>
                      <dd className="break-words font-medium">
                        {settings.updatedAt
                          ? formatDateTime(settings.updatedAt)
                          : m.common.notSet}
                      </dd>
                    </div>
                    <div className="grid gap-1 py-2 last:pb-0">
                      <dt className="text-xs text-muted-foreground">
                        {m.tenants.settings.flagsUpdated}
                      </dt>
                      <dd className="break-words font-medium">
                        {featureFlags.updatedAt
                          ? formatDateTime(featureFlags.updatedAt)
                          : m.common.notSet}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed p-8 text-center">
          <h2 className="text-base font-semibold">
            {m.tenants.settings.notFoundTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m.tenants.settings.notFoundDescription}
          </p>
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
      <h1 className="sr-only">{tenant?.name ?? m.tenants.settings.title}</h1>
      {pageHeader}
      {body}
    </section>
  );
}
