"use client";

import {
  Badge,
  Button,
  Checkbox,
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

import {
  updateTenantFeatureFlagsAction,
  updateTenantSettingsAction,
  updateTenantStatusAction,
} from "../actions";
import {
  tenantFeatureFlagOptions,
  tenantLanguageOptions,
  tenantStatusLabels,
} from "../constants";
import {
  getCurrentSaasAuthQuery,
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
import type { AuthContext } from "@cleanhub/api-client";

type TenantSettingsViewProps = {
  tenantId: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load tenant settings.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function getStatusActionLabel(status: TenantStatus): string {
  if (status === "active") {
    return "Activate";
  }

  if (status === "suspended") {
    return "Suspend";
  }

  return "Disable";
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

function SettingsSummary({
  tenant,
  settings,
  featureFlags,
}: {
  tenant: TenantDetail;
  settings: TenantSettings;
  featureFlags: TenantFeatureFlags;
}) {
  const enabledCount = Object.values(toFeatureFlagsFormValues(featureFlags))
    .filter(Boolean).length;

  return (
    <div className="grid gap-3 border-b p-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pilot status
        </p>
        <Badge className="mt-2" variant={getStatusVariant(tenant.status)}>
          {tenantStatusLabels[tenant.status]}
        </Badge>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Default language
        </p>
        <p className="mt-2 font-semibold">{settings.defaultLanguage}</p>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Default currency
        </p>
        <p className="mt-2 font-semibold">{settings.defaultCurrency}</p>
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Enabled features
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
  const [values, setValues] =
    useState<TenantSettingsFormValues>(initialValues);
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
    setSubmitting(true);

    try {
      const result = await updateTenantSettingsAction(tenantId, values);

      if (!result.ok) {
        setErrors(result.errors);
        const message = "message" in result ? result.message : undefined;

        toast.error(
          Object.values(result.errors)[0] ??
            message ??
            "Tenant settings update failed.",
        );
        return;
      }

      setErrors({});
      setValues(toSettingsFormValues(result.data));
      onUpdated(result.data);
      toast.success("Tenant settings updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">Tenant Defaults</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tenant-settings-language">Default language</Label>
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
          <Label htmlFor="tenant-settings-currency">Default currency</Label>
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
            <p className="text-xs text-destructive">
              {errors.defaultCurrency}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={disabled || submitting} type="submit">
          {submitting ? "Saving..." : "Save defaults"}
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
    setSubmitting(true);

    try {
      const result = await updateTenantFeatureFlagsAction(tenantId, values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setValues(toFeatureFlagsFormValues(result.data));
      onUpdated(result.data);
      toast.success("Tenant feature flags updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-base font-semibold">Feature Flags</h2>
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
          {submitting ? "Saving..." : "Save feature flags"}
        </Button>
      </div>
    </form>
  );
}

function TenantStatusForm({
  disabled,
  onUpdated,
  tenant,
}: {
  disabled: boolean;
  onUpdated: (tenant: TenantDetail) => void;
  tenant: TenantDetail;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<TenantStatus | null>(null);

  async function handleStatusUpdate(status: TenantStatus) {
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
        "Tenant status update failed.";
      setError(message);
      toast.error(message);
      setSubmitting(null);
      return;
    }

    onUpdated(result.data);
    setReason("");
    toast.success(`Tenant status updated to ${tenantStatusLabels[status]}.`);
    setSubmitting(null);
  }

  return (
    <section className="grid gap-4 rounded-md border p-4">
      <div>
        <h2 className="text-base font-semibold">Pilot Status</h2>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-2">
          <Label htmlFor="tenant-settings-status-reason">Reason</Label>
          <Input
            disabled={disabled || Boolean(submitting)}
            id="tenant-settings-status-reason"
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            placeholder="Required for audit log"
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
                {submitting === status ? "Updating..." : getStatusActionLabel(status)}
              </Button>
            ))}
        </div>
      </div>
    </section>
  );
}

export function TenantSettingsView({ tenantId }: TenantSettingsViewProps) {
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [featureFlags, setFeatureFlags] = useState<TenantFeatureFlags | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManageTenantSettings = authContext?.role === "super_admin";

  const loadSettings = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }

    try {
      const [loadedAuth, loadedTenant, loadedSettings, loadedFeatureFlags] =
        await Promise.all([
          getCurrentSaasAuthQuery(),
          getTenantDetailQuery(tenantId),
          getTenantSettingsQuery(tenantId),
          getTenantFeatureFlagsQuery(tenantId),
        ]);

      setAuthContext(loadedAuth);
      setAuthError(null);
      setTenant(loadedTenant);
      setSettings(loadedSettings);
      setFeatureFlags(loadedFeatureFlags);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([
      getCurrentSaasAuthQuery(),
      getTenantDetailQuery(tenantId),
      getTenantSettingsQuery(tenantId),
      getTenantFeatureFlagsQuery(tenantId),
    ])
      .then(([authResult, tenantResult, settingsResult, featureFlagsResult]) => {
        if (!isCurrent) {
          return;
        }

        if (authResult.status === "fulfilled") {
          setAuthContext(authResult.value);
          setAuthError(null);
        } else {
          setAuthContext(null);
          setAuthError(getErrorMessage(authResult.reason));
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
          <Badge variant="secondary">Tenant settings</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {tenant?.name ?? "Tenant Settings"}
          </h1>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            {tenant?.id ?? tenantId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={loading}
            onClick={() => {
              void loadSettings();
            }}
            type="button"
            variant="outline"
          >
            Refresh
          </Button>
          <Button asChild variant="outline">
            <Link href={`${webAdminRoutes.saas.tenants}/${tenantId}`}>
              Back to detail
            </Link>
          </Button>
        </div>
      </div>

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
                  : "Support users can view tenant settings. Updating defaults, pilot status, and feature flags requires Super Admin."}
              </div>
            ) : null}

            <TenantSettingsForm
              disabled={!canManageTenantSettings}
              initialValues={toSettingsFormValues(settings)}
              key={`${settings.tenantId}-${settings.updatedAt ?? "settings"}`}
              onUpdated={setSettings}
              tenantId={tenantId}
            />

            <TenantStatusForm
              disabled={!canManageTenantSettings}
              key={`${tenant.id}-${tenant.status}-${tenant.updatedAt}`}
              onUpdated={setTenant}
              tenant={tenant}
            />

            <TenantFeatureFlagsForm
              disabled={!canManageTenantSettings}
              initialValues={toFeatureFlagsFormValues(featureFlags)}
              key={`${featureFlags.tenantId}-${featureFlags.updatedAt ?? "flags"}`}
              onUpdated={setFeatureFlags}
              tenantId={tenantId}
            />

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <div>
                <span className="font-medium text-foreground">
                  Tenant updated
                </span>
                <p className="mt-1">{formatDate(tenant.updatedAt)}</p>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Settings updated
                </span>
                <p className="mt-1">{formatDate(settings.updatedAt)}</p>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Feature flags updated
                </span>
                <p className="mt-1">{formatDate(featureFlags.updatedAt)}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-5">
          <div className="grid gap-3 rounded-md border border-dashed p-8 text-center">
            <h2 className="text-base font-semibold">
              Tenant settings not found
            </h2>
            <p className="text-sm text-muted-foreground">
              The requested tenant settings could not be loaded.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
