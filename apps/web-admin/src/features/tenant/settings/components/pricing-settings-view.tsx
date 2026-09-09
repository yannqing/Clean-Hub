"use client";

import { Badge, Button, toast } from "@cleanhub/ui";
import {
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  Package,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { updateTenantDefaultCurrencyAction } from "@/features/tenant/settings/actions";
import { TaxSettingsSection } from "@/features/tenant/point-of-sale/components";
import type { PointOfSaleSettings } from "@/features/tenant/point-of-sale/types";

import { TenantDefaultCurrencyField } from "./tenant-default-currency-field";
import { TenantSettingsSurface } from "./tenant-settings-surface";
import { useTenantSettingsWorkspace } from "./tenant-settings-workspace";
import { useTenantI18n } from "@/i18n";

export function PricingSettingsView({
  taxSettings,
  taxError,
}: {
  taxSettings?: PointOfSaleSettings;
  taxError?: string;
}) {
  const { m } = useTenantI18n();
  const { authLoaded, canUpdateSettings, settings, updateSettings } =
    useTenantSettingsWorkspace();
  const [defaultCurrency, setDefaultCurrency] = useState(
    settings.defaultCurrency,
  );
  const [currencyError, setCurrencyError] = useState<string>();
  const [savingCurrency, setSavingCurrency] = useState(false);

  async function handleCurrencySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCurrency = defaultCurrency.trim().toUpperCase();
    setDefaultCurrency(normalizedCurrency);
    setCurrencyError(undefined);

    if (normalizedCurrency === settings.defaultCurrency) {
      toast.success(m.settings.settingsUpToDate);
      return;
    }

    setSavingCurrency(true);

    try {
      const result = await updateTenantDefaultCurrencyAction({
        defaultCurrency: normalizedCurrency,
      });

      if (!result.ok) {
        setCurrencyError(result.errors.defaultCurrency ?? result.message);
        toast.error(result.message);
        return;
      }

      updateSettings(result.data);
      setDefaultCurrency(result.data.defaultCurrency);
      toast.success(m.settings.settingsUpdated);
    } catch {
      setCurrencyError(m.settings.requestFailed);
      toast.error(m.settings.requestFailed);
    } finally {
      setSavingCurrency(false);
    }
  }

  return (
    <TenantSettingsSurface>
      <div className="border-b border-black/10 px-4 py-5 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-950">
          {m.settings.pricingHub.title}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
          {m.settings.pricingHub.description}
        </p>
      </div>

      <div className="divide-y divide-black/10">
        <section className="px-4 py-5 sm:px-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <CircleDollarSign aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-slate-950">
                {m.settings.pricingHub.defaultCurrencyTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {m.settings.pricingHub.defaultCurrencyDescription}
              </p>

              <form
                className="mt-4 grid max-w-xl gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                onSubmit={handleCurrencySubmit}
              >
                <TenantDefaultCurrencyField
                  disabled={
                    savingCurrency || !authLoaded || !canUpdateSettings
                  }
                  error={currencyError}
                  id="pricing-default-currency"
                  onChange={(value) => {
                    setDefaultCurrency(value);
                    setCurrencyError(undefined);
                  }}
                  value={defaultCurrency}
                />
                {canUpdateSettings ? (
                  <Button
                    disabled={savingCurrency || !authLoaded}
                    size="sm"
                    type="submit"
                  >
                    {savingCurrency
                      ? m.common.saving
                      : m.settings.pricingHub.saveDefaultCurrency}
                  </Button>
                ) : (
                  <Badge className="w-fit" variant="outline">
                    {authLoaded
                      ? m.settings.readOnly
                      : m.settings.checkingPermissions}
                  </Badge>
                )}
              </form>
            </div>
          </div>
        </section>

        <TaxSettingsSection
          canManage={canUpdateSettings}
          initialError={taxError}
          initialSettings={taxSettings}
        />

        <section className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Package aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-slate-950">
                {m.settings.pricingHub.productsTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {m.settings.pricingHub.productsDescription}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 gap-2" size="sm" variant="outline">
            <Link href={webAdminRoutes.tenant.products}>
              {m.settings.pricingHub.openProducts}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </section>

        <section className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <ClipboardList aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-slate-950">
                {m.settings.pricingHub.servicesTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {m.settings.pricingHub.servicesDescription}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 gap-2" size="sm" variant="outline">
            <Link href={webAdminRoutes.tenant.services}>
              {m.settings.pricingHub.openServices}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </section>
      </div>

      <div className="border-t border-black/10 bg-slate-50 px-4 py-4 sm:px-5">
        <p className="text-xs font-medium text-slate-800">
          {m.settings.pricingHub.noteTitle}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {m.settings.pricingHub.noteDescription}
        </p>
      </div>
    </TenantSettingsSurface>
  );
}
