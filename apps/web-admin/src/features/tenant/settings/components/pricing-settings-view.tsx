"use client";

import { Button } from "@cleanhub/ui";
import {
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  Package,
} from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { TaxSettingsSection } from "@/features/tenant/point-of-sale/components";
import type { PointOfSaleSettings } from "@/features/tenant/point-of-sale/types";
import { TaxRatesSection } from "@/features/tenant/tax-rates/components";
import type { TaxRate } from "@/features/tenant/tax-rates/types";

import { TenantSettingsSurface } from "./tenant-settings-surface";
import { TenantTaxTemplateSection } from "./tenant-tax-template-section";
import { useTenantSettingsWorkspace } from "./tenant-settings-workspace";
import { useTenantI18n } from "@/i18n";

export function PricingSettingsView({
  taxSettings,
  taxError,
  taxRates,
  taxRatesLoadFailed,
}: {
  taxSettings?: PointOfSaleSettings;
  taxError?: string;
  taxRates: TaxRate[];
  taxRatesLoadFailed: boolean;
}) {
  const { locale, m } = useTenantI18n();
  const { canUpdateSettings, settings } =
    useTenantSettingsWorkspace();

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

              <div className="mt-4 grid max-w-xl gap-2">
                <span className="text-xs font-medium">{m.settings.labels.defaultCurrency}</span>
                <div className="rounded-md border border-input bg-slate-50 px-3 py-2 text-sm font-medium">
                  {settings.defaultCurrency}
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  {locale === "zh-CN"
                    ? "币种由国家税务模板决定。需要更换国家或币种时，请联系 SaaS 管理员统一调整。"
                    : locale === "fr"
                      ? "La devise suit le modèle fiscal du pays. Contactez l'administrateur SaaS pour changer de pays ou de devise."
                      : "Currency follows the country tax template. Contact a SaaS administrator to change the country or currency."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <TenantTaxTemplateSection
          canManage={canUpdateSettings}
          tenantCountry={settings.country}
          settingsVersion={taxSettings?.version}
          appliedCountryCode={taxSettings?.taxTemplateCountryCode}
          appliedTemplateVersion={taxSettings?.taxTemplateVersion}
          taxEnabled={taxSettings?.taxEnabled}
          taxRegistrationNumber={taxSettings?.taxRegistrationNumber}
          key={`${taxSettings?.version}:${taxSettings?.taxTemplateCountryCode}:${taxSettings?.taxTemplateVersion}`}
        />

        <TaxSettingsSection
          canManage={canUpdateSettings}
          initialError={taxError}
          initialSettings={taxSettings}
          key={taxSettings?.version}
        />

        <TaxRatesSection
          canManage={canUpdateSettings && !taxSettings?.taxTemplateCountryCode}
          templateManaged={Boolean(taxSettings?.taxTemplateCountryCode)}
          initialRates={taxRates}
          loadFailed={taxRatesLoadFailed}
          key={taxRates.map((rate) => `${rate.id}:${rate.version}`).join(",")}
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
