"use client";

import { Button, Icon } from "@cleanhub/ui";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SaasPageHeader } from "@/features/saas/shared";
import { useSaasI18n } from "@/i18n";
import { securitySettingsDefaultValues } from "../constants";
import { getSecuritySettingsQuery } from "../queries";
import type { SecuritySettings } from "../types";
import { SecurityEventListView } from "./security-event-list-view";
import { SecuritySettingsForm } from "./security-settings-form";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
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
  const { m } = useSaasI18n();
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
      setSettingsError(getErrorMessage(loadError) || m.security.page.loadError);
    } finally {
      setLoadingSettings(false);
    }
  }, [m.security.page.loadError]);

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
          setSettingsError(
            getErrorMessage(loadError) || m.security.page.loadError,
          );
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
  }, [m.security.page.loadError]);

  return (
    <section className="space-y-7 pb-16">
      <SaasPageHeader
        actions={
          <Button
            className="h-8 gap-1.5 px-2.5 text-xs"
            disabled={loadingSettings}
            onClick={loadSettings}
            size="sm"
            type="button"
            variant="outline"
          >
            <Icon
              aria-hidden
              className={loadingSettings ? "animate-spin" : undefined}
              icon={RefreshCw}
              size={14}
            />
            {m.security.page.refreshSettings}
          </Button>
        }
        icon={ShieldCheck}
        title={m.security.page.title}
      />

      <div className="w-full max-w-[860px]">
        {loadingSettings ? (
          <div className="grid gap-3 border-y bg-background px-5 py-6">
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-36 animate-pulse rounded-md bg-muted" />
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
            key={
              settings?.updatedAt ??
              settings?.version ??
              "default-security-settings"
            }
            onUpdated={setSettings}
          />
        )}
      </div>

      <SecurityEventListView />
    </section>
  );
}
