"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { webAdminApi } from "@/lib/api-client";
import { useTenantI18n } from "@/i18n";

import { updateTenantSettingsAction } from "../actions";
import {
  tenantPilotStatusLabels,
  tenantSettingsFeatureFlagOptions,
  tenantSettingsLanguageOptions,
} from "../constants";
import { getTenantSettingsQuery } from "../queries";
import type {
  TenantSettings,
  TenantSettingsFormValues,
  TenantSettingsLanguage,
} from "../types";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(settings: TenantSettings): TenantSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
  };
}

function normalizeFormValues(
  values: TenantSettingsFormValues,
): TenantSettingsFormValues {
  return {
    defaultLanguage: values.defaultLanguage,
    defaultCurrency: values.defaultCurrency.trim().toUpperCase(),
    timezone: values.timezone.trim(),
  };
}

function hasSettingsChange(
  settings: TenantSettings,
  values: TenantSettingsFormValues,
): boolean {
  const normalizedValues = normalizeFormValues(values);

  return (
    normalizedValues.defaultLanguage !== settings.defaultLanguage ||
    normalizedValues.defaultCurrency !== settings.defaultCurrency ||
    normalizedValues.timezone !== settings.timezone
  );
}

const defaultFormValues: TenantSettingsFormValues = {
  defaultLanguage: "en",
  defaultCurrency: "XOF",
  timezone: "UTC",
};

export type TenantSettingsViewProps = {
  initialAuthContext?: AuthContext | null;
  initialSettings?: TenantSettings;
};

export function TenantSettingsView({
  initialAuthContext,
  initialSettings,
}: TenantSettingsViewProps = {}) {
  const { m, formatDateTime } = useTenantI18n();
  const [authContext, setAuthContext] = useState<AuthContext | null>(
    initialAuthContext ?? null,
  );
  const [authLoaded, setAuthLoaded] = useState(
    initialAuthContext !== undefined,
  );
  const [settings, setSettings] = useState<TenantSettings | null>(
    initialSettings ?? null,
  );
  const [form, setForm] = useState<TenantSettingsFormValues>(
    initialSettings ? toFormValues(initialSettings) : defaultFormValues,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantSettingsFormValues, string>>
  >({});
  const [loading, setLoading] = useState(!initialSettings);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const enabledFeatureCount = useMemo(() => {
    if (!settings) {
      return 0;
    }

    return tenantSettingsFeatureFlagOptions.filter(
      (option) => settings.featureFlags[option.key],
    ).length;
  }, [settings]);
  const canUpdateSettings =
    authContext?.role === "owner" &&
    authContext.tenantId === settings?.tenantId;
  const formDisabled = saving || !authLoaded || !canUpdateSettings;

  async function loadSettings() {
    setLoading(true);
    setLoadError(null);
    setSaveError(null);

    const [settingsResult, authResult] = await Promise.allSettled([
      getTenantSettingsQuery(),
      webAdminApi.auth.me(),
    ]);

    setAuthContext(
      authResult.status === "fulfilled" ? authResult.value : null,
    );
    setAuthError(
      authResult.status === "fulfilled" ? null : m.settings.permissionDenied,
    );
    setAuthLoaded(true);

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value);
      setForm(toFormValues(settingsResult.value));
      setErrors({});
      setLoadError(null);
    } else {
      setSettings(null);
      setLoadError(
        getErrorMessage(settingsResult.reason, m.settings.requestFailed),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([
      initialSettings
        ? Promise.resolve(initialSettings)
        : getTenantSettingsQuery(),
      initialAuthContext !== undefined
        ? Promise.resolve(initialAuthContext)
        : webAdminApi.auth.me(),
    ])
      .then(([settingsResult, authResult]) => {
        if (!isCurrent) {
          return;
        }

        setAuthContext(
          authResult.status === "fulfilled" ? authResult.value : null,
        );
        setAuthError(
          authResult.status === "fulfilled"
            ? null
            : m.settings.permissionDenied,
        );
        setAuthLoaded(true);

        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value);
          setForm(toFormValues(settingsResult.value));
          setLoadError(null);
        } else {
          setSettings(null);
          setLoadError(
            getErrorMessage(settingsResult.reason, m.settings.requestFailed),
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
  }, [initialAuthContext, initialSettings, m.settings.permissionDenied, m.settings.requestFailed]);

  function updateForm<K extends keyof TenantSettingsFormValues>(
    key: K,
    value: TenantSettingsFormValues[K],
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    if (!canUpdateSettings) {
      setSaveError(m.settings.onlyOwners);
      toast.error(m.settings.onlyOwners);
      return;
    }

    const normalizedForm = normalizeFormValues(form);
    setForm(normalizedForm);

    if (!hasSettingsChange(settings, normalizedForm)) {
      setErrors({});
      setSaveError(null);
      toast.success(m.settings.settingsUpToDate);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const result = await updateTenantSettingsAction(normalizedForm);

      if (result.ok) {
        setSettings(result.data);
        setForm(toFormValues(result.data));
        setErrors({});
        toast.success(m.settings.settingsUpdated);
      } else {
        setErrors(result.errors);
        setSaveError(result.message);
        toast.error(result.message);
      }
    } catch (error) {
      const message = getErrorMessage(error, m.settings.requestFailed);
      setErrors({});
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="grid gap-5 p-5">
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="h-80 animate-pulse rounded-md bg-muted" />
          <div className="h-80 animate-pulse rounded-md bg-muted" />
        </div>
      </section>
    );
  }

  if (loadError || !settings) {
    return (
      <section className="p-5">
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError ?? m.settings.unavailable}</span>
          <Button
            onClick={loadSettings}
            size="sm"
            type="button"
            variant="outline"
          >
            {m.common.retry}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">{m.settings.eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {settings.tenantName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {m.settings.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {tenantPilotStatusLabels[settings.pilotStatus]}
          </Badge>
          <Badge variant="outline">v{settings.version}</Badge>
          <Badge variant="outline">
            {enabledFeatureCount} / {tenantSettingsFeatureFlagOptions.length}{" "}
            {m.settings.featuresCount}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <form
          className="grid gap-5 rounded-md border bg-background p-5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
            <Label>{m.settings.labels.pilotStatus}</Label>
            <Badge className="w-fit" variant="outline">
              {tenantPilotStatusLabels[settings.pilotStatus]}
            </Badge>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant-default-language">
              {m.settings.labels.defaultLanguage}
            </Label>
            <Select
              disabled={formDisabled}
              onValueChange={(value) =>
                updateForm("defaultLanguage", value as TenantSettingsLanguage)
              }
              value={form.defaultLanguage}
            >
              <SelectTrigger className="w-full" id="tenant-default-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenantSettingsLanguageOptions.map((option) => (
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
            <Label htmlFor="tenant-default-currency">
              {m.settings.labels.defaultCurrency}
            </Label>
            <Input
              aria-invalid={Boolean(errors.defaultCurrency)}
              disabled={formDisabled}
              id="tenant-default-currency"
              maxLength={3}
              onChange={(event) =>
                updateForm("defaultCurrency", event.target.value.toUpperCase())
              }
              value={form.defaultCurrency}
            />
            {errors.defaultCurrency ? (
              <p className="text-xs text-destructive">
                {errors.defaultCurrency}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant-timezone">{m.settings.labels.timezone}</Label>
            <Input
              aria-invalid={Boolean(errors.timezone)}
              disabled={formDisabled}
              id="tenant-timezone"
              onChange={(event) => updateForm("timezone", event.target.value)}
              placeholder="Africa/Dakar"
              value={form.timezone}
            />
            {errors.timezone ? (
              <p className="text-xs text-destructive">{errors.timezone}</p>
            ) : null}
          </div>

          {saveError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {saveError}
            </div>
          ) : null}

          {authLoaded && !canUpdateSettings ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {authError ?? m.settings.onlyOwnersReadonly}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {canUpdateSettings ? (
              <Button disabled={formDisabled} type="submit">
                {saving ? m.common.saving : m.settings.saveSettings}
              </Button>
            ) : !authLoaded ? (
              <Badge className="w-fit" variant="outline">
                {m.settings.checkingPermissions}
              </Badge>
            ) : (
              <Badge className="w-fit" variant="outline">
                {authError
                  ? m.settings.permissionUnavailable
                  : m.settings.readOnly}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              {m.settings.updatedLabel}{" "}
              {settings.updatedAt
                ? formatDateTime(settings.updatedAt) || m.settings.notUpdated
                : m.settings.notUpdated}
            </p>
          </div>
        </form>

        <aside className="rounded-md border bg-background p-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-semibold">{m.settings.featureFlags}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.settings.featureFlagsDesc}
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {tenantSettingsFeatureFlagOptions.map((option) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border p-3"
                key={option.key}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <Badge
                  variant={
                    settings.featureFlags[option.key] ? "default" : "outline"
                  }
                >
                  {settings.featureFlags[option.key]
                    ? m.settings.flagStates.enabled
                    : m.settings.flagStates.disabled}
                </Badge>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
