"use client";

import { Badge, Button, Input, Label, toast } from "@cleanhub/ui";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { fractionToPercent } from "@/features/tenant/tax-rates/percent";
import { useTenantI18n } from "@/i18n";

import { updateTaxSettingsAction } from "../actions/update-tax-settings.action";
import type { PointOfSaleSettings } from "../types";

type Copy = {
  title: string;
  description: string;
  enabled: string;
  enabledHint: string;
  inclusive: string;
  inclusiveHint: string;
  rate: string;
  rateHint: string;
  registration: string;
  registrationHint: string;
  save: string;
  saving: string;
  saved: string;
  readOnly: string;
  on: string;
  off: string;
  loadError: string;
};

const copy: Record<"en" | "fr" | "zh-CN", Copy> = {
  en: {
    title: "VAT and tax",
    description:
      "The country template controls tax status, rate and inclusive pricing. The owner enters the receipt tax number here. Orders retain their tax snapshot.",
    enabled: "Enable VAT",
    enabledHint: "Set by the SaaS country tax template.",
    inclusive: "Prices include tax",
    inclusiveHint: "Set by the SaaS country tax template.",
    rate: "Default VAT rate (%)",
    rateHint: "Set by the SaaS country tax template; used when an item has no tax class.",
    registration: "Tax registration number",
    registrationHint: "Printed on receipts when VAT is enabled.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Tax settings saved.",
    readOnly: "Read only",
    on: "On",
    off: "Off",
    loadError: "Tax settings could not be saved.",
  },
  fr: {
    title: "TVA et taxes",
    description:
      "Le modèle du pays définit l'activation, le taux et les prix TTC. Le propriétaire saisit ici le numéro fiscal des reçus. Chaque commande conserve ses données fiscales.",
    enabled: "Activer la TVA",
    enabledHint: "Défini par le modèle fiscal du pays dans SaaS.",
    inclusive: "Prix TTC",
    inclusiveHint: "Défini par le modèle fiscal du pays dans SaaS.",
    rate: "Taux de TVA par défaut (%)",
    rateHint: "Défini par le modèle du pays et utilisé si l'article n'a pas de classe fiscale.",
    registration: "Numéro d'identification fiscale",
    registrationHint: "Imprimé sur les reçus lorsque la TVA est activée.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Paramètres fiscaux enregistrés.",
    readOnly: "Lecture seule",
    on: "Activé",
    off: "Désactivé",
    loadError: "Les paramètres fiscaux n'ont pas pu être enregistrés.",
  },
  "zh-CN": {
    title: "VAT / 税务设置",
    description:
      "启用状态、税率和含税方式由国家税务模板管理；店主在这里填写小票税号。订单会保存当时的税务快照。",
    enabled: "启用 VAT",
    enabledHint: "由 SaaS 国家税务模板统一配置。",
    inclusive: "标价含税",
    inclusiveHint: "由 SaaS 国家税务模板统一配置。",
    rate: "默认 VAT 税率（%）",
    rateHint: "由 SaaS 国家税务模板设置；未指定税类的项目使用此税率。",
    registration: "税务登记号",
    registrationHint: "启用 VAT 后会打印在小票上。",
    save: "保存修改",
    saving: "保存中…",
    saved: "税务设置已保存。",
    readOnly: "只读",
    on: "开启",
    off: "关闭",
    loadError: "税务设置保存失败。",
  },
};

type TaxForm = {
  taxRegistrationNumber: string | null;
};

function toForm(settings: PointOfSaleSettings): TaxForm {
  return {
    taxRegistrationNumber: settings.taxRegistrationNumber,
  };
}

export function TaxSettingsSection({
  canManage,
  initialSettings,
  initialError,
}: {
  canManage: boolean;
  initialSettings?: PointOfSaleSettings;
  initialError?: string;
}) {
  const { locale } = useTenantI18n();
  const router = useRouter();
  const text = copy[locale];
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<TaxForm | null>(
    initialSettings ? toForm(initialSettings) : null,
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!settings || !form) return;
    setSaving(true);

    try {
      const result = await updateTaxSettingsAction({
        version: settings.version,
        taxRegistrationNumber: form.taxRegistrationNumber,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setSettings(result.data);
      setForm(toForm(result.data));
      toast.success(text.saved);
      router.refresh();
    } catch {
      toast.error(text.loadError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="px-4 py-5 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Receipt aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-slate-950">{text.title}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              {text.description}
            </p>
          </div>
        </div>
        {canManage && form ? (
          <Button
            className="shrink-0"
            disabled={saving}
            onClick={save}
            size="sm"
            type="button"
          >
            {saving ? text.saving : text.save}
          </Button>
        ) : (
          <Badge className="w-fit shrink-0" variant="outline">
            {text.readOnly}
          </Badge>
        )}
      </div>

      {initialError ? (
        <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {initialError}
        </p>
      ) : null}

      {form ? (
        <div className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-3">
            <div className="min-w-0">
              <span className="text-sm font-medium">{text.enabled}</span>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {text.enabledHint}
              </p>
            </div>
            <Badge variant="outline">{settings?.taxEnabled ? text.on : text.off}</Badge>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-3">
            <div className="min-w-0">
              <span className="text-sm font-medium">{text.inclusive}</span>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {text.inclusiveHint}
              </p>
            </div>
            <Badge variant="outline">{settings?.pricesIncludeTax ? text.on : text.off}</Badge>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">{text.rate}</span>
            <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
              {fractionToPercent(settings?.defaultTaxRate ?? "0")} %
            </div>
            <p className="text-xs leading-5 text-slate-500">{text.rateHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pricing-tax-registration">
              {text.registration}
            </Label>
            <Input
              disabled={!canManage || saving}
              id="pricing-tax-registration"
              maxLength={200}
              onChange={(event) =>
                setForm({
                  ...form,
                  taxRegistrationNumber: event.target.value || null,
                })
              }
              value={form.taxRegistrationNumber ?? ""}
            />
            <p className="text-xs leading-5 text-slate-500">
              {text.registrationHint}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
