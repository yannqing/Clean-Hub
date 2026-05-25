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
import { useEffect, useState } from "react";

import { updatePlatformSettingsAction } from "../actions";
import { platformLanguageOptions } from "../constants";
import { getPlatformSettingsQuery } from "../queries";
import type {
  PlatformSettings,
  PlatformSettingsFormValues,
  PlatformSettingsLanguage,
} from "../types";

const defaultFormValues: PlatformSettingsFormValues = {
  defaultLanguage: "en",
  defaultCurrency: "XOF",
  timezone: "UTC",
  maintenanceMode: false,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load platform settings.";
}

function toFormValues(
  settings: PlatformSettings,
): PlatformSettingsFormValues {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    maintenanceMode: settings.maintenanceMode,
  };
}

export function PlatformSettingsView() {
  const [form, setForm] =
    useState<PlatformSettingsFormValues>(defaultFormValues);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [meta, setMeta] = useState<{
    updatedAt: string | null;
    updatedBy: string | null;
    version: number;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    getPlatformSettingsQuery()
      .then((data) => {
        if (!isCurrent) return;

        if (data) {
          setForm(toFormValues(data));
          setMeta({
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
            version: data.version,
          });
        }

        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const result = await updatePlatformSettingsAction(form);

    if (result.ok) {
      setForm(toFormValues(result.data));
      setMeta({
        updatedAt: result.data.updatedAt,
        updatedBy: result.data.updatedBy,
        version: result.data.version,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.error);
    }

    setSaving(false);
  }

  return (
    <section className="p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <Badge variant="secondary">SaaS platform settings</Badge>
          <h1 className="mt-4 text-2xl font-semibold">Platform Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Platform-level default configuration applied across all tenants.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div className="h-10 animate-pulse rounded bg-muted" key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="platform-default-language">
                Default Language
              </Label>
              <Select
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultLanguage: value as PlatformSettingsLanguage,
                  }))
                }
                value={form.defaultLanguage}
              >
                <SelectTrigger
                  className="w-full"
                  id="platform-default-language"
                >
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
              <Label htmlFor="platform-default-currency">
                Default Currency
              </Label>
              <Input
                id="platform-default-currency"
                maxLength={3}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultCurrency: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="XOF"
                value={form.defaultCurrency}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="platform-timezone">Timezone</Label>
              <Input
                id="platform-timezone"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
                placeholder="Africa/Dakar"
                value={form.timezone}
              />
            </div>

            <div className="flex items-center gap-3 rounded-md border p-4">
              <Checkbox
                checked={form.maintenanceMode}
                id="platform-maintenance-mode"
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    maintenanceMode: checked === true,
                  }))
                }
              />
              <div>
                <Label
                  className="cursor-pointer font-medium"
                  htmlFor="platform-maintenance-mode"
                >
                  Maintenance Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Temporarily restrict platform access for maintenance.
                </p>
              </div>
            </div>

            {saveError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {saveError}
              </div>
            ) : null}

            {saveSuccess ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Settings saved successfully.
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : "Save Settings"}
              </Button>

              {meta ? (
                <p className="text-xs text-muted-foreground">
                  v{meta.version}
                  {meta.updatedAt
                    ? ` · updated ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(meta.updatedAt))}`
                    : null}
                </p>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
