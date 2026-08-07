"use client";

import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { useTenantI18n } from "@/i18n";

import { updateTenantSettingsAction } from "../actions";
import {
  TENANT_SETTINGS_UPDATED_EVENT,
  type TenantSettingsUpdatedEventDetail,
} from "../events";
import {
  tenantSettingsFeatureFlagOptions,
  tenantSettingsLanguageOptions,
} from "../constants";
import type {
  TenantSettings,
  TenantSettingsFormValues,
  TenantSettingsLanguage,
} from "../types";
import {
  tenantSettingsNavigationItems,
  useTenantSettingsWorkspace,
} from "./tenant-settings-workspace";
import { TenantDefaultCurrencyField } from "./tenant-default-currency-field";
import { TenantTimezoneField } from "./tenant-timezone-field";

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

function SettingsSection({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description?: string;
  id?: string;
  title: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      id={id}
    >
      <div className="border-b border-black/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function TenantSettingsView() {
  const { m, formatDateTime } = useTenantI18n();
  const { authError, authLoaded, canUpdateSettings, settings, updateSettings } =
    useTenantSettingsWorkspace();
  const [form, setForm] = useState<TenantSettingsFormValues>(() =>
    toFormValues(settings),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof TenantSettingsFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const enabledFeatureCount = useMemo(
    () =>
      tenantSettingsFeatureFlagOptions.filter(
        (option) => settings.featureFlags[option.key],
      ).length,
    [settings],
  );
  const formDisabled = saving || !authLoaded || !canUpdateSettings;

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
        updateSettings(result.data);
        setForm(toFormValues(result.data));
        window.dispatchEvent(
          new CustomEvent<TenantSettingsUpdatedEventDetail>(
            TENANT_SETTINGS_UPDATED_EVENT,
            {
              detail: {
                defaultLanguage: result.data.defaultLanguage,
                timezone: result.data.timezone,
              },
            },
          ),
        );
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

  return (
    <div className="grid max-w-[800px] gap-4">
      <SettingsSection
        description={m.settings.general.businessDetailsDescription}
        title={m.settings.general.businessDetailsTitle}
      >
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Building2 aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-950">
                  {settings.tenantName}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {m.settings.general.entityLabel}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {m.settings.pilotStatusLabels[settings.pilotStatus]}
              </Badge>
              <Badge variant="outline">v{settings.version}</Badge>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {m.settings.general.businessDetailsHint}
          </p>
        </div>
      </SettingsSection>

      {!canUpdateSettings && authLoaded ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">{m.settings.general.readOnlyTitle}</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            {authError ?? m.settings.onlyOwnersReadonly}
          </p>
        </div>
      ) : null}

      <SettingsSection
        description={m.settings.general.storeDefaultsDescription}
        id="store-defaults"
        title={m.settings.general.storeDefaultsTitle}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 p-4 sm:p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TenantDefaultCurrencyField
                disabled={formDisabled}
                error={errors.defaultCurrency}
                id="tenant-default-currency"
                onChange={(value) => updateForm("defaultCurrency", value)}
                value={form.defaultCurrency}
              />

              <div className="grid gap-2">
                <Label htmlFor="tenant-default-language">
                  {m.settings.labels.defaultLanguage}
                </Label>
                <Select
                  disabled={formDisabled}
                  onValueChange={(value) =>
                    updateForm(
                      "defaultLanguage",
                      value as TenantSettingsLanguage,
                    )
                  }
                  value={form.defaultLanguage}
                >
                  <SelectTrigger
                    className="w-full bg-white"
                    id="tenant-default-language"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantSettingsLanguageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {m.settings.languageLabels[option.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-slate-500">
                  {m.settings.general.languageHint}
                </p>
                {errors.defaultLanguage ? (
                  <p className="text-xs text-destructive">
                    {errors.defaultLanguage}
                  </p>
                ) : null}
              </div>
            </div>

            <TenantTimezoneField
              disabled={formDisabled}
              error={errors.timezone}
              id="tenant-timezone"
              onChange={(value) => updateForm("timezone", value)}
              value={form.timezone}
            />

            {saveError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {saveError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-black/10 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              {m.settings.updatedLabel}{" "}
              {settings.updatedAt
                ? formatDateTime(settings.updatedAt) || m.settings.notUpdated
                : m.settings.notUpdated}
            </p>
            {canUpdateSettings ? (
              <Button disabled={formDisabled} size="sm" type="submit">
                {saving ? m.common.saving : m.settings.saveSettings}
              </Button>
            ) : !authLoaded ? (
              <Badge variant="outline">{m.settings.checkingPermissions}</Badge>
            ) : (
              <Badge variant="outline">{m.settings.readOnly}</Badge>
            )}
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        description={m.settings.general.featureAccessDescription}
        title={m.settings.general.featureAccessTitle}
      >
        <div className="divide-y divide-slate-100">
          {tenantSettingsFeatureFlagOptions.map((option) => {
            const enabled = settings.featureFlags[option.key];

            return (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                key={option.key}
              >
                <span className="text-sm font-medium text-slate-800">
                  {m.settings.featureFlagLabels[option.key]}
                </span>
                <Badge variant={enabled ? "default" : "outline"}>
                  {enabled
                    ? m.settings.flagStates.enabled
                    : m.settings.flagStates.disabled}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className="border-t border-black/10 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 sm:px-5">
          {enabledFeatureCount} / {tenantSettingsFeatureFlagOptions.length}{" "}
          {m.settings.featuresCount}
        </div>
      </SettingsSection>

      <SettingsSection
        description={m.settings.general.resourcesDescription}
        title={m.settings.general.resourcesTitle}
      >
        <div className="grid sm:grid-cols-2">
          {tenantSettingsNavigationItems
            .filter((item) => item.key !== "general")
            .map((item) => {
              const ResourceIcon = item.icon;

              return (
                <Link
                  className="group flex items-center gap-3 border-b border-slate-100 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5 sm:odd:border-r"
                  href={item.href}
                  key={item.key}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-white">
                    <ResourceIcon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {m.settings.navigation.items[item.key]}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {m.settings.general.resourceDescriptions[item.key]}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-slate-400"
                  />
                </Link>
              );
            })}
        </div>
      </SettingsSection>
    </div>
  );
}
