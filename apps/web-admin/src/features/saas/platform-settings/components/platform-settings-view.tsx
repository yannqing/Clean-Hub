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
} from "@cleanhub/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { updatePlatformSettingsAction } from "../actions";
import { platformLanguageOptions, platformSettingsDefaultValues } from "../constants";
import { getPlatformSettingsQuery } from "../queries";
import type { PlatformSettings, PlatformSettingsFormValues } from "../types";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load platform settings.";
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
      setSettingsError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

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
          setSettingsError(getErrorMessage(loadError));
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
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setNotice(null);

    const result = await updatePlatformSettingsAction(form);

    if (result.ok) {
      setSettings(result.data);
      setForm(toFormValues(result.data));
      setNotice("Platform settings saved successfully.");
    } else {
      setFormError(result.error);
    }

    setSubmitting(false);
  }

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS platform</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Platform Settings
          </h1>
        </div>

        <Button onClick={loadSettings} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      {notice ? (
        <div className="border-b p-5">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            {notice}
          </div>
        </div>
      ) : null}

      <div className="p-5">
        {loading ? (
          <div className="grid gap-3 rounded-md border p-4">
            <div className="h-8 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          </div>
        ) : settingsError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {settingsError}
          </div>
        ) : (
          <form
            className="grid gap-4 rounded-md border p-4"
            noValidate
            onSubmit={handleSubmit}
          >
            <h2 className="text-base font-semibold">Default Configuration</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="platform-language">Default language</Label>
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
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platform-currency">Default currency</Label>
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
                <Label htmlFor="platform-timezone">Timezone</Label>
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

              <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={form.maintenanceMode}
                  onCheckedChange={(checked) => {
                    setForm((current) => ({
                      ...current,
                      maintenanceMode: checked === true,
                    }));
                  }}
                />
                Maintenance mode
              </label>
            </div>

            {settings ? (
              <div className="text-xs text-muted-foreground">
                Last updated:{" "}
                {settings.updatedAt
                  ? new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(settings.updatedAt))
                  : "Never"}
              </div>
            ) : null}

            {formError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
