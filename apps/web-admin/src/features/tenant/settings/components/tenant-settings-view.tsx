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
import { useEffect, useMemo, useState } from "react";

import { webAdminApi } from "@/lib/api-client";

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Tenant settings failed to load.";
}

function toFormValues(settings: TenantSettings): TenantSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
  };
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TenantSettingsView() {
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [form, setForm] = useState<TenantSettingsFormValues>({
    defaultLanguage: "en",
    defaultCurrency: "XOF",
    timezone: "UTC",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantSettingsFormValues, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const formDisabled = saving || !canUpdateSettings;

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([getTenantSettingsQuery(), webAdminApi.auth.me()])
      .then(([settingsResult, authResult]) => {
        if (!isCurrent) {
          return;
        }

        if (authResult.status === "fulfilled") {
          setAuthContext(authResult.value);
        } else {
          setAuthContext(null);
        }

        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value);
          setForm(toFormValues(settingsResult.value));
          setLoadError(null);
          return;
        }

        setSettings(null);
        setLoadError(getErrorMessage(settingsResult.reason));
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpdateSettings) {
      const message = "Only tenant owners can update tenant settings.";
      setSaveError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await updateTenantSettingsAction(form);

    if (result.ok) {
      setSettings(result.data);
      setForm(toFormValues(result.data));
      setErrors({});
      toast.success("Tenant settings updated.");
    } else {
      setErrors(result.errors);
      setSaveError(result.message);
      toast.error(result.message);
    }

    setSaving(false);
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
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {loadError ?? "Tenant settings are unavailable."}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-6 p-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">Tenant Settings</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            {settings.tenantName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tenant defaults and read-only feature flags for the current account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {tenantPilotStatusLabels[settings.pilotStatus]}
          </Badge>
          <Badge variant="outline">v{settings.version}</Badge>
          <Badge variant="outline">
            {enabledFeatureCount} / {tenantSettingsFeatureFlagOptions.length}{" "}
            features
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <form
          className="grid gap-5 rounded-md border bg-background p-5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
            <Label>Pilot status</Label>
            <Badge className="w-fit" variant="outline">
              {tenantPilotStatusLabels[settings.pilotStatus]}
            </Badge>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenant-default-language">Default language</Label>
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
            <Label htmlFor="tenant-default-currency">Default currency</Label>
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
            <Label htmlFor="tenant-timezone">Timezone</Label>
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

          {!canUpdateSettings ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Only tenant owners can update these defaults. Managers can view
              settings and feature flags.
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button disabled={formDisabled} type="submit">
              {saving ? "Saving..." : "Save settings"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Updated {formatDate(settings.updatedAt)}
            </p>
          </div>
        </form>

        <aside className="rounded-md border bg-background p-5">
          <div className="border-b pb-3">
            <h2 className="text-base font-semibold">Feature flags</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Managed by SaaS administrators.
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
                  {settings.featureFlags[option.key] ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
