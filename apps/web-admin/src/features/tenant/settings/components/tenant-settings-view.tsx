"use client";

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
import { Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { useTenantI18n } from "@/i18n";

import {
  updateTenantProfileAction,
  updateTenantSettingsAction,
} from "../actions";
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
  TenantProfileFormValues,
} from "../types";
import {
  tenantSettingsNavigationItems,
  useTenantSettingsWorkspace,
} from "./tenant-settings-workspace";
import { TenantTimezoneField } from "./tenant-timezone-field";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function toFormValues(settings: TenantSettings): TenantSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    timezone: settings.timezone,
  };
}

function toProfileFormValues(settings: TenantSettings): TenantProfileFormValues {
  return {
    tenantName: settings.tenantName,
    country: settings.country ?? "",
    city: settings.city ?? "",
    contactName: settings.contactName ?? "",
    contactPhone: settings.contactPhone ?? "",
    contactEmail: settings.contactEmail ?? "",
    tenantVersion: settings.tenantVersion,
  };
}

function normalizeProfileFormValues(
  values: TenantProfileFormValues,
): TenantProfileFormValues {
  return {
    ...values,
    tenantName: values.tenantName.trim(),
    country: values.country.trim(),
    city: values.city.trim(),
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    contactEmail: values.contactEmail.trim(),
  };
}

function hasProfileChange(
  settings: TenantSettings,
  values: TenantProfileFormValues,
): boolean {
  const normalized = normalizeProfileFormValues(values);

  return (
    normalized.tenantName !== settings.tenantName ||
    normalized.city !== (settings.city ?? "") ||
    normalized.contactName !== (settings.contactName ?? "") ||
    normalized.contactPhone !== (settings.contactPhone ?? "") ||
    normalized.contactEmail !== (settings.contactEmail ?? "")
  );
}

function normalizeFormValues(
  values: TenantSettingsFormValues,
): TenantSettingsFormValues {
  return {
    defaultLanguage: values.defaultLanguage,
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
  const { locale, m, formatDateTime } = useTenantI18n();
  const { authError, authLoaded, canUpdateSettings, settings, updateSettings } =
    useTenantSettingsWorkspace();
  const [form, setForm] = useState<TenantSettingsFormValues>(() =>
    toFormValues(settings),
  );
  const [profileForm, setProfileForm] = useState<TenantProfileFormValues>(() =>
    toProfileFormValues(settings),
  );
  const [profileErrors, setProfileErrors] = useState<
    Partial<Record<keyof TenantProfileFormValues, string>>
  >({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
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
  const profileFormDisabled =
    savingProfile || !authLoaded || !canUpdateSettings;

  function updateProfileForm<K extends keyof TenantProfileFormValues>(
    key: K,
    value: TenantProfileFormValues[K],
  ): void {
    setProfileForm((current) => ({ ...current, [key]: value }));
    setProfileErrors((current) => ({ ...current, [key]: undefined }));
    setProfileSaveError(null);
  }

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
                tenantName: result.data.tenantName,
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

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpdateSettings) {
      setProfileSaveError(m.settings.onlyOwners);
      toast.error(m.settings.onlyOwners);
      return;
    }

    const normalizedForm = normalizeProfileFormValues(profileForm);
    setProfileForm(normalizedForm);

    if (!hasProfileChange(settings, normalizedForm)) {
      setProfileErrors({});
      setProfileSaveError(null);
      toast.success(m.settings.businessDetailsUpToDate);
      return;
    }

    setSavingProfile(true);
    setProfileSaveError(null);

    try {
      const result = await updateTenantProfileAction(normalizedForm);

      if (result.ok) {
        updateSettings(result.data);
        setProfileForm(toProfileFormValues(result.data));
        setProfileErrors({});
        toast.success(m.settings.businessDetailsUpdated);
      } else {
        setProfileErrors(result.errors);
        setProfileSaveError(result.message);
        toast.error(result.message);
      }
    } catch (error) {
      const message = getErrorMessage(error, m.settings.requestFailed);
      setProfileErrors({});
      setProfileSaveError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="grid max-w-[800px] gap-4">
      <SettingsSection
        description={m.settings.general.businessDetailsDescription}
        title={m.settings.general.businessDetailsTitle}
      >
        <form onSubmit={handleProfileSubmit}>
          <div className="grid gap-5 p-4 sm:p-5">
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

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="tenant-name">
                  {m.settings.labels.tenantName}
                </Label>
                <Input
                  autoComplete="organization"
                  disabled={profileFormDisabled}
                  id="tenant-name"
                  maxLength={160}
                  onChange={(event) =>
                    updateProfileForm("tenantName", event.target.value)
                  }
                  value={profileForm.tenantName}
                />
                {profileErrors.tenantName ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.tenantName}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-code">
                  {m.settings.labels.pressingCode}
                </Label>
                <Input
                  className="bg-slate-50 text-slate-600"
                  id="tenant-code"
                  readOnly
                  value={settings.pressingCode}
                />
              </div>

              <div className="grid gap-2">
                <Label>{m.settings.labels.pilotStatus}</Label>
                <div className="flex min-h-9 items-center rounded-md border border-input bg-slate-50 px-3">
                  <Badge variant="secondary">
                    {m.settings.pilotStatusLabels[settings.pilotStatus]}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-country">
                  {m.settings.labels.country}
                </Label>
                <Input
                  autoComplete="country-name"
                  id="tenant-country"
                  maxLength={80}
                  readOnly
                  value={profileForm.country}
                />
                <p className="text-xs text-muted-foreground">
                  {locale === "zh-CN"
                    ? "国家由 SaaS 管理员修改，以便同步税务模板和币种。"
                    : locale === "fr"
                      ? "Le pays est modifié par l'administrateur SaaS pour synchroniser le modèle fiscal et la devise."
                      : "A SaaS administrator changes the country so the tax template and currency stay in sync."}
                </p>
                {profileErrors.country ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.country}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-city">{m.settings.labels.city}</Label>
                <Input
                  autoComplete="address-level2"
                  disabled={profileFormDisabled}
                  id="tenant-city"
                  maxLength={120}
                  onChange={(event) =>
                    updateProfileForm("city", event.target.value)
                  }
                  value={profileForm.city}
                />
                {profileErrors.city ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.city}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-contact-name">
                  {m.settings.labels.contactName}
                </Label>
                <Input
                  autoComplete="name"
                  disabled={profileFormDisabled}
                  id="tenant-contact-name"
                  maxLength={120}
                  onChange={(event) =>
                    updateProfileForm("contactName", event.target.value)
                  }
                  value={profileForm.contactName}
                />
                {profileErrors.contactName ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.contactName}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tenant-contact-phone">
                  {m.settings.labels.contactPhone}
                </Label>
                <Input
                  autoComplete="tel"
                  disabled={profileFormDisabled}
                  id="tenant-contact-phone"
                  inputMode="tel"
                  maxLength={32}
                  onChange={(event) =>
                    updateProfileForm("contactPhone", event.target.value)
                  }
                  value={profileForm.contactPhone}
                />
                {profileErrors.contactPhone ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.contactPhone}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="tenant-contact-email">
                  {m.settings.labels.contactEmail}
                </Label>
                <Input
                  autoComplete="email"
                  disabled={profileFormDisabled}
                  id="tenant-contact-email"
                  inputMode="email"
                  maxLength={320}
                  onChange={(event) =>
                    updateProfileForm("contactEmail", event.target.value)
                  }
                  type="email"
                  value={profileForm.contactEmail}
                />
                {profileErrors.contactEmail ? (
                  <p className="text-xs text-destructive">
                    {profileErrors.contactEmail}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              {m.settings.general.businessDetailsHint}
            </p>

            {profileSaveError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {profileSaveError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-black/10 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              {m.settings.updatedLabel}{" "}
              {formatDateTime(settings.tenantUpdatedAt) ||
                m.settings.notUpdated}
            </p>
            {canUpdateSettings ? (
              <Button disabled={profileFormDisabled} size="sm" type="submit">
                {savingProfile
                  ? m.common.saving
                  : m.settings.saveBusinessDetails}
              </Button>
            ) : !authLoaded ? (
              <Badge variant="outline">{m.settings.checkingPermissions}</Badge>
            ) : (
              <Badge variant="outline">{m.settings.readOnly}</Badge>
            )}
          </div>
        </form>
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

              <TenantTimezoneField
                disabled={formDisabled}
                error={errors.timezone}
                id="tenant-timezone"
                onChange={(value) => updateForm("timezone", value)}
                value={form.timezone}
              />
            </div>

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
