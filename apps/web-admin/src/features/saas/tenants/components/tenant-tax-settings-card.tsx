"use client";

import type { SaasTenantTaxSettings } from "@cleanhub/api-client";
import { Button, Card, CardContent, Checkbox, Input, Label } from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { useSaasI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

export function TenantTaxSettingsCard({ tenantId, canEdit, onSaved }: {
  tenantId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { locale } = useSaasI18n();
  const copy = locale === "zh-CN"
    ? { title: "租户税务配置", enabled: "启用税务", included: "价格含税", rate: "默认税率（0.18 = 18%）", number: "税务登记号", save: "保存税务配置", saved: "已保存", loadError: "无法加载税务配置" }
    : locale === "fr"
      ? { title: "Fiscalité du locataire", enabled: "Taxe activée", included: "Prix TTC", rate: "Taux par défaut (saisir 0.18 pour 18 %)", number: "Numéro fiscal", save: "Enregistrer", saved: "Enregistré", loadError: "Chargement impossible" }
      : { title: "Tenant tax settings", enabled: "Tax enabled", included: "Prices include tax", rate: "Default rate (0.18 = 18%)", number: "Tax registration number", save: "Save tax settings", saved: "Saved", loadError: "Could not load tax settings" };
  const [form, setForm] = useState<SaasTenantTaxSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    webAdminApi.saas.tenants.getTaxSettings(tenantId)
      .then((data) => { if (active) setForm(data); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : copy.loadError);
      });
    return () => { active = false; };
  }, [tenantId, copy.loadError]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await webAdminApi.saas.tenants.updateTaxSettings(tenantId, form);
      setForm(updated);
      setNotice(copy.saved);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="grid gap-3 py-5">
        <h2 className="text-sm font-semibold">{copy.title}</h2>
        {form ? <>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.taxEnabled} disabled={!canEdit} onCheckedChange={(value) => setForm({ ...form, taxEnabled: value === true })} />{copy.enabled}</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.pricesIncludeTax} disabled={!canEdit} onCheckedChange={(value) => setForm({ ...form, pricesIncludeTax: value === true })} />{copy.included}</label>
          <div className="grid gap-1"><Label htmlFor="saas-tax-rate">{copy.rate}</Label><Input disabled={!canEdit} id="saas-tax-rate" inputMode="decimal" onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })} value={form.defaultTaxRate} /></div>
          <div className="grid gap-1"><Label htmlFor="saas-tax-number">{copy.number}</Label><Input disabled={!canEdit} id="saas-tax-number" onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value || null })} value={form.taxRegistrationNumber ?? ""} /></div>
          {canEdit ? <Button disabled={saving} onClick={() => void save()} size="sm" type="button">{copy.save}</Button> : null}
        </> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
      </CardContent>
    </Card>
  );
}
