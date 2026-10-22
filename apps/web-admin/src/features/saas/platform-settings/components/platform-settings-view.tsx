"use client";

import {
  Button,
  Checkbox,
  Icon,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useSaasI18n } from "@/i18n";
import { updatePlatformSettingsAction } from "../actions";
import {
  platformLanguageOptions,
  platformSettingsDefaultValues,
} from "../constants";
import { getPlatformSettingsQuery } from "../queries";
import type {
  PlatformSettings,
  PlatformSettingsFormValues,
  UpdatePlatformSettingsRequest,
} from "../types";

const preferredCurrencies = ["XOF", "XAF", "EUR", "USD", "CNY", "GBP"];
const currencies = [
  ...preferredCurrencies,
  ...Intl.supportedValuesOf("currency")
    .filter((value) => !preferredCurrencies.includes(value))
    .sort(),
];
const preferredTimezones = [
  "UTC",
  "Africa/Dakar",
  "Africa/Abidjan",
  "Africa/Bamako",
  "Africa/Lagos",
  "Europe/Paris",
  "Asia/Shanghai",
];
const timezones = [
  ...preferredTimezones,
  ...Intl.supportedValuesOf("timeZone")
    .filter((value) => !preferredTimezones.includes(value))
    .sort(),
];

function toFormValues(settings: PlatformSettings): PlatformSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    maintenanceMode: settings.maintenanceMode,
  };
}

export function PlatformSettingsView({
  section = "defaults",
}: {
  section?: "defaults" | "maintenance";
}) {
  const { m, formatDateTime } = useSaasI18n();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<PlatformSettingsFormValues>(
    platformSettingsDefaultValues,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPlatformSettingsQuery();
      setSettings(data);
      setForm(toFormValues(data));
      setFormError(null);
      setNotice(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : m.platformSettings.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [m.platformSettings.loadError]);

  useEffect(() => {
    let current = true;
    getPlatformSettingsQuery()
      .then((data) => {
        if (!current) return;
        setSettings(data);
        setForm(toFormValues(data));
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (current)
          setLoadError(
            error instanceof Error
              ? error.message
              : m.platformSettings.loadError,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [m.platformSettings.loadError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    const input: UpdatePlatformSettingsRequest =
      section === "maintenance"
        ? { maintenanceMode: form.maintenanceMode }
        : {
            defaultLanguage: form.defaultLanguage,
            defaultCurrency: form.defaultCurrency,
            timezone: form.timezone,
          };
    const result = await updatePlatformSettingsAction(input);
    if (result.ok) {
      setSettings(result.data);
      setForm(toFormValues(result.data));
      setNotice(m.platformSettings.saveSuccess);
    } else {
      setFormError(result.error);
    }
    setSubmitting(false);
  }

  const currencyOptions = [
    form.defaultCurrency,
    ...currencies.filter((value) => value !== form.defaultCurrency),
  ].filter(Boolean);
  const timezoneOptions = [
    form.timezone,
    ...timezones.filter((value) => value !== form.timezone),
  ].filter(Boolean);

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={loading}
          onClick={() => void loadSettings()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon
            aria-hidden
            className={loading ? "animate-spin" : undefined}
            icon={RefreshCw}
            size={14}
          />
          {m.common.refresh}
        </Button>
      </div>
      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {loading ? (
        <div className="grid gap-3 rounded-xl border bg-background px-5 py-6">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-36 animate-pulse rounded-md bg-muted" />
        </div>
      ) : loadError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <form
          className="grid gap-5 rounded-xl border bg-background px-5 py-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          {section === "defaults" ? (
            <>
              <p className="text-sm font-semibold">
                {m.platformSettings.defaultConfig}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="platform-language">
                    {m.platformSettings.defaultLanguage}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        defaultLanguage:
                          value as PlatformSettingsFormValues["defaultLanguage"],
                      }))
                    }
                    value={form.defaultLanguage}
                  >
                    <SelectTrigger id="platform-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platformLanguageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.value === "en"
                            ? m.common.languageLabels.en
                            : option.value === "zh-CN"
                              ? m.common.languageLabels.zhCN
                              : option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="platform-currency">
                    {m.platformSettings.defaultCurrency}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        defaultCurrency: value,
                      }))
                    }
                    value={form.defaultCurrency}
                  >
                    <SelectTrigger id="platform-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="platform-timezone">
                    {m.platformSettings.timezone}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, timezone: value }))
                    }
                    value={form.timezone}
                  >
                    <SelectTrigger id="platform-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="flex min-h-12 items-center gap-3 rounded-md border px-4 py-3 text-sm">
                <Checkbox
                  checked={form.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      maintenanceMode: checked === true,
                    }))
                  }
                />
                {m.platformSettings.maintenanceMode}
              </label>
              <p className="text-sm text-muted-foreground">
                {m.platformSettings.workspace.maintenanceHint}
              </p>
            </>
          )}
          {settings ? (
            <p className="text-xs text-muted-foreground">
              {m.platformSettings.lastUpdated}{" "}
              {settings.updatedAt
                ? formatDateTime(settings.updatedAt)
                : m.common.never}
            </p>
          ) : null}
          {formError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              className="h-9"
              disabled={submitting}
              size="sm"
              type="submit"
            >
              {submitting ? m.common.saving : m.platformSettings.saveSettings}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
