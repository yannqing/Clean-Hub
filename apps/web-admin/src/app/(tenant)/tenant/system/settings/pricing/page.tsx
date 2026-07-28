"use client";

import { Button } from "@cleanhub/ui";
import { ArrowRight, ClipboardList, Package } from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { TenantSettingsSurface } from "@/features/tenant/settings/components";
import { useTenantI18n } from "@/i18n";

export default function TenantSettingsPricingPage() {
  const { m } = useTenantI18n();

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
