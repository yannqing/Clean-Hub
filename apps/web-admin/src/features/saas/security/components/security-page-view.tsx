"use client";

import { Badge, Button } from "@cleanhub/ui";
import { useCallback, useEffect, useState } from "react";

import { securitySettingsDefaultValues } from "../constants";
import { getSecuritySettingsQuery } from "../queries";
import type { SecuritySettings } from "../types";
import { SecurityEventListView } from "./security-event-list-view";
import { SecuritySettingsForm } from "./security-settings-form";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to load security settings.";
}

function toFormValues(settings: SecuritySettings) {
  return {
    passwordMinLength: settings.passwordMinLength,
    passwordRequiresNumber: settings.passwordRequiresNumber,
    passwordRequiresSymbol: settings.passwordRequiresSymbol,
    loginMaxAttempts: settings.loginMaxAttempts,
    lockoutMinutes: settings.lockoutMinutes,
    refreshTokenDays: settings.refreshTokenDays,
  };
}

export function SecurityPageView() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setSettingsError(null);

    try {
      const data = await getSecuritySettingsQuery();
      setSettings(data);
    } catch (loadError) {
      setSettingsError(getErrorMessage(loadError));
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getSecuritySettingsQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setSettings(data);
        setSettingsError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setSettingsError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoadingSettings(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="min-h-[560px]">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="secondary">SaaS security</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal">
            Security Management
          </h1>
        </div>

        <Button onClick={loadSettings} type="button" variant="outline">
          Refresh settings
        </Button>
      </div>

      <div className="grid gap-5 p-5">
        {loadingSettings ? (
          <div className="grid gap-3 rounded-md border p-4">
            <div className="h-8 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          </div>
        ) : settingsError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {settingsError}
          </div>
        ) : (
          <SecuritySettingsForm
            initialValues={
              settings ? toFormValues(settings) : securitySettingsDefaultValues
            }
            key={settings?.updatedAt ?? "default-security-settings"}
            onUpdated={setSettings}
          />
        )}

        <SecurityEventListView />
      </div>
    </section>
  );
}
