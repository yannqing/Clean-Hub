"use client";

import {
  Button,
  Checkbox,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cleanhub/ui";
import { RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { SaasPageHeader } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { updatePlatformSettingsAction } from "../actions";
import {
  platformLanguageOptions,
  platformSettingsDefaultValues,
} from "../constants";
import { getPlatformSettingsQuery } from "../queries";
import type { PlatformSettings, PlatformSettingsFormValues } from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function toFormValues(settings: PlatformSettings): PlatformSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    maintenanceMode: settings.maintenanceMode,
  };
}

export function PlatformSettingsView() {
  const { m, formatDateTime } = useSaasI18n();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [form, setForm] = useState<PlatformSettingsFormValues>(
    platformSettingsDefaultValues,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setSettingsError(null);

    try {
      const data = await getPlatformSettingsQuery();
      setSettings(data);
      setForm(toFormValues(data));
    } catch (loadError) {
      setSettingsError(
        getErrorMessage(loadError) || m.platformSettings.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [m.platformSettings.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getPlatformSettingsQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setSettings(data);
        setForm(toFormValues(data));
        setSettingsError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setSettingsError(
            getErrorMessage(loadError) || m.platformSettings.loadError,
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
  }, [m.platformSettings.loadError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    const result = await updatePlatformSettingsAction(form);

    if (result.ok) {
      setSettings(result.data);
      setForm(toFormValues(result.data));
      setNotice(m.platformSettings.saveSuccess);
    } else {
      setFormError(result.error);
    }

    setSubmitting(false);
  }

  return (
    <section className="mx-auto w-full max-w-[860px] space-y-7 pb-16">
      <SaasPageHeader
        actions={
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={loading}
            onClick={loadSettings}
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
        }
        icon={Settings}
        title={m.platformSettings.title}
      />

      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 border-y bg-background px-5 py-6">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-36 animate-pulse rounded-md bg-muted" />
        </div>
      ) : settingsError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {settingsError}
        </div>
      ) : (
        <form
          className="grid gap-5 border-y bg-background px-5 py-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <p className="text-sm font-semibold">
            {m.platformSettings.defaultConfig}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="platform-language">
                {m.platformSettings.defaultLanguage}
              </Label>
              <Select
                onValueChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    defaultLanguage:
                      value as PlatformSettingsFormValues["defaultLanguage"],
                  }));
                }}
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
              <Input
                id="platform-currency"
                maxLength={8}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    defaultCurrency: event.target.value,
                  }));
                }}
                placeholder="XOF"
                value={form.defaultCurrency}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="platform-timezone">
                {m.platformSettings.timezone}
              </Label>
              <Input
                id="platform-timezone"
                maxLength={64}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }));
                }}
                placeholder="Africa/Dakar"
                value={form.timezone}
              />
            </div>

            <label className="flex min-h-10 items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={form.maintenanceMode}
                onCheckedChange={(checked) => {
                  setForm((current) => ({
                    ...current,
                    maintenanceMode: checked === true,
                  }));
                }}
              />
              {m.platformSettings.maintenanceMode}
            </label>
          </div>

          {settings ? (
            <div className="text-xs text-muted-foreground">
              {m.platformSettings.lastUpdated}{" "}
              {settings.updatedAt
                ? formatDateTime(settings.updatedAt)
                : m.common.never}
            </div>
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
