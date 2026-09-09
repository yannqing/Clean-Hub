"use client";

import { Badge, Button, Checkbox, Input, Label, toast } from "@cleanhub/ui";
import { Receipt } from "lucide-react";
import { useState } from "react";

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
  loadError: string;
};

const copy: Record<"en" | "fr" | "zh-CN", Copy> = {
  en: {
    title: "VAT and tax",
    description:
      "The rate, inclusive setting and tax number are frozen onto each order when it is placed, so past orders never change with these settings.",
    enabled: "Enable VAT",
    enabledHint: "POS price previews and checkout calculate and store VAT.",
    inclusive: "Prices include tax",
    inclusiveHint:
      "On, listed prices already contain tax. Off, tax is added on top of the subtotal.",
    rate: "Default VAT rate (%)",
    rateHint: "Applied to new orders unless a service overrides it.",
    registration: "Tax registration number",
    registrationHint: "Printed on receipts when VAT is enabled.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Tax settings saved.",
    readOnly: "Read only",
    loadError: "Tax settings could not be saved.",
  },
  fr: {
    title: "TVA et taxes",
    description:
      "Le taux, le mode d'inclusion et le numéro fiscal sont figés sur chaque commande à sa création : les commandes passées ne changent jamais.",
    enabled: "Activer la TVA",
    enabledHint:
      "Les aperçus de prix et l'encaissement calculent et enregistrent la TVA.",
    inclusive: "Prix TTC",
    inclusiveHint:
      "Activé, les prix affichés incluent la taxe. Désactivé, la taxe s'ajoute au sous-total.",
    rate: "Taux de TVA par défaut (%)",
    rateHint:
      "Appliqué aux nouvelles commandes, sauf si un service le remplace.",
    registration: "Numéro d'identification fiscale",
    registrationHint: "Imprimé sur les reçus lorsque la TVA est activée.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Paramètres fiscaux enregistrés.",
    readOnly: "Lecture seule",
    loadError: "Les paramètres fiscaux n'ont pas pu être enregistrés.",
  },
  "zh-CN": {
    title: "VAT / 税务设置",
    description:
      "下单时会把税率、含税方式和税号固化到订单上，历史订单不会随这里的设置变化。",
    enabled: "启用 VAT",
    enabledHint: "启用后，POS 价格预览和结账都会计算并保存 VAT。",
    inclusive: "标价含税",
    inclusiveHint: "开启表示商品标价已含税；关闭表示税额在小计之外增加。",
    rate: "默认 VAT 税率（%）",
    rateHint: "新订单默认使用该税率，服务可单独覆盖。",
    registration: "税务登记号",
    registrationHint: "启用 VAT 后会打印在小票上。",
    save: "保存修改",
    saving: "保存中…",
    saved: "税务设置已保存。",
    readOnly: "只读",
    loadError: "税务设置保存失败。",
  },
};

type TaxForm = {
  taxEnabled: boolean;
  pricesIncludeTax: boolean;
  defaultTaxRate: string;
  taxRegistrationNumber: string | null;
};

function toForm(settings: PointOfSaleSettings): TaxForm {
  return {
    taxEnabled: settings.taxEnabled,
    pricesIncludeTax: settings.pricesIncludeTax,
    defaultTaxRate: settings.defaultTaxRate,
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
  const text = copy[locale];
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<TaxForm | null>(
    initialSettings ? toForm(initialSettings) : null,
  );
  const [saving, setSaving] = useState(false);

  const disabled = !canManage || saving;

  async function save() {
    if (!settings || !form) return;
    setSaving(true);

    try {
      const result = await updateTaxSettingsAction({
        version: settings.version,
        ...form,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setSettings(result.data);
      setForm(toForm(result.data));
      toast.success(text.saved);
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
              <Label className="text-sm" htmlFor="pricing-tax-enabled">
                {text.enabled}
              </Label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {text.enabledHint}
              </p>
            </div>
            <Checkbox
              checked={form.taxEnabled}
              disabled={disabled}
              id="pricing-tax-enabled"
              onCheckedChange={(value) =>
                setForm({ ...form, taxEnabled: value === true })
              }
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-3">
            <div className="min-w-0">
              <Label className="text-sm" htmlFor="pricing-prices-include-tax">
                {text.inclusive}
              </Label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {text.inclusiveHint}
              </p>
            </div>
            <Checkbox
              checked={form.pricesIncludeTax}
              disabled={disabled || !form.taxEnabled}
              id="pricing-prices-include-tax"
              onCheckedChange={(value) =>
                setForm({ ...form, pricesIncludeTax: value === true })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pricing-tax-rate">{text.rate}</Label>
            <Input
              disabled={disabled || !form.taxEnabled}
              id="pricing-tax-rate"
              max={100}
              min={0}
              onChange={(event) =>
                setForm({
                  ...form,
                  defaultTaxRate: String(
                    Number(event.target.value || 0) / 100,
                  ),
                })
              }
              step="0.01"
              type="number"
              value={Number(form.defaultTaxRate) * 100}
            />
            <p className="text-xs leading-5 text-slate-500">{text.rateHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pricing-tax-registration">
              {text.registration}
            </Label>
            <Input
              disabled={disabled || !form.taxEnabled}
              id="pricing-tax-registration"
              maxLength={120}
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
