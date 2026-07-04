"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Checkbox,
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
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { webAdminRoutes } from "@/config/routes";
import { getCurrentAuthQuery } from "@/features/auth/queries";
import { useSaasI18n } from "@/i18n";
import { interpolate } from "@/i18n/messages/saas";

import {
  updateTenantFeatureFlagsAction,
  updateTenantSettingsAction,
  updateTenantStatusAction,
} from "../actions";
import { getTenantLoadErrorMessage } from "../actions/tenant-action-errors";
import {
  tenantFeatureFlagOptions,
  tenantLanguageOptions,
} from "../constants";
import {
  getTenantDetailQuery,
  getTenantFeatureFlagsQuery,
  getTenantSettingsQuery,
} from "../queries";
import type {
  TenantDetail,
  TenantFeatureFlags,
  TenantFeatureFlagsFormValues,
  TenantSettings,
  TenantSettingsFormValues,
  TenantStatus,
} from "../types";

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

function toFeatureFlagsFormValues(
  featureFlags: TenantFeatureFlags,
): TenantFeatureFlagsFormValues {
  return {
    laundryEnabled: featureFlags.laundryEnabled,
    carWashEnabled: featureFlags.carWashEnabled,
    retailProductsEnabled: featureFlags.retailProductsEnabled,
    deliveryEnabled: featureFlags.deliveryEnabled,
    notificationsEnabled: featureFlags.notificationsEnabled,
  };
}

function canWriteTenant(authContext: AuthContext | null): boolean {
  return Boolean(
    authContext &&
      authContext.tenantId === null &&
      (authContext.role === "super_admin" ||
        authContext.permissions.includes("saas:tenant:write")),
  );
}

function canUpdateTenantStatus(authContext: AuthContext | null): boolean {
  return authContext?.role === "super_admin" && authContext.tenantId === null;
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
  const { m, formatDateTime } = useSaasI18n();
  const enabledCount = Object.values(
    toFeatureFlagsFormValues(featureFlags),
  ).filter(Boolean).length;

  return (
    <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {m.tenants.settings.pilotStatus}
        </p>
        <Badge className="mt-2" variant={getStatusVariant(tenant.status)}>
          {m.common.statusLabels[tenant.status]}
        </Badge>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {m.tenants.detail.fields.defaultLanguage}
        </p>
        <p className="mt-2 font-semibold">{settings.defaultLanguage}</p>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {m.tenants.detail.fields.defaultCurrency}
        </p>
        <p className="mt-2 font-semibold">{settings.defaultCurrency}</p>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {m.tenants.settings.enabledFeatures}
        </p>
        <p className="mt-2 font-semibold">
          {enabledCount} / {tenantFeatureFlagOptions.length}
        </p>
      </div>
    </div>
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
  const { m } = useSaasI18n();
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
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">
          {m.tenants.settings.defaultsSection}
        </h2>
      </div>

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
            <p className="text-xs text-destructive">{errors.defaultLanguage}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tenant-settings-currency">
            {m.tenants.detail.fields.defaultCurrency}
          </Label>
          <Input
            aria-invalid={Boolean(errors.defaultCurrency)}
            disabled={disabled || submitting}
            id="tenant-settings-currency"
            maxLength={3}
            onChange={(event) =>
              updateValue("defaultCurrency", event.target.value)
            }
            value={values.defaultCurrency}
          />
          {errors.defaultCurrency ? (
            <p className="text-xs text-destructive">{errors.defaultCurrency}</p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={disabled || submitting} type="submit">
          {submitting ? m.common.saving : m.tenants.settings.saveDefaults}
        </Button>
      </div>
    </form>
  );
}

function TenantFeatureFlagsForm({
  disabled,
  initialValues,
  onUpdated,
  tenantId,
}: {
  disabled: boolean;
  initialValues: TenantFeatureFlagsFormValues;
  onUpdated: (featureFlags: TenantFeatureFlags) => void;
  tenantId: string;
}) {
  const { m } = useSaasI18n();
  const [values, setValues] =
    useState<TenantFeatureFlagsFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  function updateValue(
    key: keyof TenantFeatureFlagsFormValues,
    value: boolean,
  ): void {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await updateTenantFeatureFlagsAction(tenantId, values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setValues(toFeatureFlagsFormValues(result.data));
      onUpdated(result.data);
      toast.success(m.tenants.settings.flagsSaved);
    } catch (error) {
      toast.error(
        getTenantLoadErrorMessage(error, m.tenants.settings.flagsSaveFailed),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">
          {m.tenants.settings.featureFlagsSection}
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tenantFeatureFlagOptions.map((option) => (
          <label
            className="flex min-h-24 items-start gap-3 rounded-md border px-3 py-3 text-sm"
            key={option.key}
          >
            <Checkbox
              checked={values[option.key]}
              disabled={disabled || submitting}
              onCheckedChange={(checked) =>
                updateValue(option.key, checked === true)
              }
            />
            <span className="grid gap-1">
              <span className="font-medium leading-none">{option.label}</span>
              <span className="text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button disabled={disabled || submitting} type="submit">
          {submitting ? m.common.saving : m.tenants.settings.saveFeatureFlags}
        </Button>
      </div>
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
    <section className="grid gap-4 rounded-md border p-4">
      <div>
        <h2 className="text-base font-semibold">{m.tenants.settings.pilotSection}</h2>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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

        <div className="flex flex-wrap gap-2">
          {(["active", "suspended", "disabled"] as const)
            .filter((status) => status !== tenant.status)
            .map((status) => (
              <Button
                disabled={disabled || Boolean(submitting)}
                key={status}
                onClick={() => {
                  void handleStatusUpdate(status);
                }}
                type="button"
                variant={status === "active" ? "default" : "outline"}
              >
                {submitting === status
                  ? m.common.updating
                  : getStatusActionLabel(status, m)}
              </Button>
            ))}
        </div>
      </div>
    </section>
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
    [],
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
          getTenantLoadErrorMessage(
            loadError,
            m.tenants.settings.loadError,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [applyLoadResults, tenantId],
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
            getTenantLoadErrorMessage(
              loadError,
              m.tenants.settings.loadError,
            ),
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
    <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Badge variant="secondary">{m.tenants.settings.badge}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {tenant?.name ?? m.tenants.settings.title}
        </h1>
        <p className="mt-2 break-all text-sm text-muted-foreground">
          {tenant?.id ?? tenantId}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {refreshButton}
        <Button asChild variant="outline">
          <Link href={`${webAdminRoutes.saas.tenants}/${tenantId}`}>
            {m.tenants.settings.backToDetail}
          </Link>
        </Button>
      </div>
    </div>
  ) : (
    <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <DialogTitle className="text-lg">
            {tenant?.name ?? m.tenants.settings.title}
          </DialogTitle>
          <p className="break-all text-sm text-muted-foreground">
            {tenant?.id ?? tenantId}
          </p>
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
        <div className="grid gap-4 p-5">
          <div className="h-28 animate-pulse rounded-md bg-muted" />
          <div className="h-52 animate-pulse rounded-md bg-muted" />
          <div className="h-72 animate-pulse rounded-md bg-muted" />
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : tenant && settings && featureFlags ? (
        <>
          <SettingsSummary
            tenant={tenant}
            settings={settings}
            featureFlags={featureFlags}
          />

          <div className="grid gap-5 p-5">
            {authError || !canManageTenantSettings ? (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                {authError
                  ? `Tenant settings are read-only because the current session could not be verified: ${authError}`
                  : m.tenants.settings.readOnlyHint}
              </div>
            ) : null}

            {!canManageTenantStatus ? (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                {m.tenants.settings.statusPermissionHint}
              </div>
            ) : null}

            <TenantSettingsForm
              disabled={!canManageTenantSettings}
              initialValues={toSettingsFormValues(settings)}
              key={`${settings.tenantId}-${settings.updatedAt ?? "settings"}`}
              onUpdated={(nextSettings) => {
                setSettings(nextSettings);
                onTenantUpdated?.();
              }}
              tenantId={tenantId}
            />

            <TenantStatusForm
              disabled={!canManageTenantStatus}
              key={`${tenant.id}-${tenant.status}-${tenant.updatedAt}`}
              onTenantUpdated={onTenantUpdated}
              onUpdated={setTenant}
              tenant={tenant}
            />

            <TenantFeatureFlagsForm
              disabled={!canManageTenantSettings}
              initialValues={toFeatureFlagsFormValues(featureFlags)}
              key={`${featureFlags.tenantId}-${featureFlags.updatedAt ?? "flags"}`}
              onUpdated={(nextFlags) => {
                setFeatureFlags(nextFlags);
                onTenantUpdated?.();
              }}
              tenantId={tenantId}
            />

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <div>
                <span className="font-medium text-foreground">
                  {m.tenants.settings.tenantUpdated}
                </span>
                <p className="mt-1">
                  {tenant.updatedAt
                    ? formatDateTime(tenant.updatedAt)
                    : m.common.notSet}
                </p>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {m.tenants.settings.settingsUpdated}
                </span>
                <p className="mt-1">
                  {settings.updatedAt
                    ? formatDateTime(settings.updatedAt)
                    : m.common.notSet}
                </p>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {m.tenants.settings.flagsUpdated}
                </span>
                <p className="mt-1">
                  {featureFlags.updatedAt
                    ? formatDateTime(featureFlags.updatedAt)
                    : m.common.notSet}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">
              {m.tenants.settings.notFoundTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.tenants.settings.notFoundDescription}
            </p>
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
