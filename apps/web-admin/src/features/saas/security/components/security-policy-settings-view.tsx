"use client";

import { Button, Icon } from "@cleanhub/ui";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";
import { securitySettingsDefaultValues } from "../constants";
import { getSecuritySettingsQuery } from "../queries";
import type { SecuritySettings } from "../types";
import { SecuritySettingsForm } from "./security-settings-form";

export function SecurityPolicySettingsView() {
  const { m } = useSaasI18n();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await getSecuritySettingsQuery());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : m.security.page.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [m.security.page.loadError]);

  useEffect(() => {
    let current = true;
    getSecuritySettingsQuery()
      .then((data) => {
        if (!current) return;
        setSettings(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error ? cause.message : m.security.page.loadError,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [m.security.page.loadError]);

  const initialValues = settings
    ? {
        passwordMinLength: settings.passwordMinLength,
        passwordRequiresNumber: settings.passwordRequiresNumber,
        passwordRequiresSymbol: settings.passwordRequiresSymbol,
        loginMaxAttempts: settings.loginMaxAttempts,
        lockoutMinutes: settings.lockoutMinutes,
        refreshTokenDays: settings.refreshTokenDays,
      }
    : securitySettingsDefaultValues;

  return (
    <section className="space-y-4">
      <div className="flex justify-between gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href={webAdminRoutes.saas.system.security}>
            {m.platformSettings.workspace.securityEvents}
          </Link>
        </Button>
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
      {loading ? (
        <div className="grid gap-3 rounded-xl border bg-background px-5 py-6">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-36 animate-pulse rounded-md bg-muted" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <SecuritySettingsForm
          initialValues={initialValues}
          key={
            settings?.updatedAt ??
            settings?.version ??
            "default-security-settings"
          }
          onUpdated={setSettings}
        />
      )}
    </section>
  );
}
