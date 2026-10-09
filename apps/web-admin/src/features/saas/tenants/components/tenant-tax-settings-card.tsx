"use client";

import type { SaasTenantTaxSettings } from "@cleanhub/api-client";
import { Button, Card, CardContent, Input, Label } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

export function TenantTaxSettingsCard({ tenantId, canEdit, templateApplied, onSaved }: {
  tenantId: string;
  canEdit: boolean;
  templateApplied: boolean;
  onSaved: () => void;
}) {
  const { locale } = useSaasI18n();
  const copy = locale === "zh-CN"
    ? { title: "租户税务配置", enabled: "启用税务", included: "价格含税", rate: "默认税率", number: "税务登记号", yes: "是", no: "否", source: "已应用国家税务模板", missing: "尚未应用国家税务模板。请让租户店主在 POS 设置中选择并应用模板；完成前 POS 无法结款。", stale: "国家税务模板已有更新或与租户国家不一致。请让店主在 POS 设置中重新应用模板；完成前 POS 无法结款。", managed: "税率和含税方式由国家税务模板及租户的模板选择管理。SaaS 在此可协助填写税务登记号。", templates: "管理国家税务模板", save: "保存税务登记号", saved: "已保存，租户与 POS 将使用更新后的税务登记号", loadError: "无法加载税务配置" }
    : locale === "fr"
      ? { title: "Fiscalité du locataire", enabled: "Taxe activée", included: "Prix TTC", rate: "Taux par défaut", number: "Numéro fiscal", yes: "Oui", no: "Non", source: "Modèle fiscal national appliqué", missing: "Aucun modèle national appliqué. Le propriétaire doit en choisir un dans les paramètres POS avant l'encaissement.", stale: "Le modèle fiscal national a changé ou ne correspond plus au pays. Le propriétaire doit le réappliquer avant l'encaissement.", managed: "Le taux et le mode TTC suivent le modèle national choisi par le locataire. Le numéro fiscal peut être saisi ici.", templates: "Gérer les modèles fiscaux", save: "Enregistrer le numéro fiscal", saved: "Enregistré pour le locataire et le POS", loadError: "Chargement impossible" }
      : { title: "Tenant tax settings", enabled: "Tax enabled", included: "Prices include tax", rate: "Default tax rate", number: "Tax registration number", yes: "Yes", no: "No", source: "Applied country tax template", missing: "No country tax template is applied. The tenant owner must select and apply one in POS settings before checkout.", stale: "The country tax template changed or no longer matches this tenant. The owner must apply it again in POS settings before checkout.", managed: "The tax rate and price mode follow the country template selected by the tenant. SaaS can enter the tax registration number here.", templates: "Manage country tax templates", save: "Save tax registration number", saved: "Saved for the tenant and POS", loadError: "Could not load tax settings" };
  const applyCopy = locale === "zh-CN"
    ? { action: "应用当前国家税务模板", done: "模板已应用。请确认税务登记号已填写，POS 才能结款。", saveFirst: "请先保存税务登记号，再应用模板。", missing: "尚未应用国家税务模板。请先配置国家模板，然后由 SaaS 管理员在此应用，或由店主在 POS 设置中应用；完成前 POS 无法结款。", stale: "国家税务模板已更新或与租户国家不一致。请在此重新应用，或由店主在 POS 设置中应用；完成前 POS 无法结款。" }
    : locale === "fr"
      ? { action: "Appliquer le modèle fiscal actuel", done: "Modèle appliqué. Vérifiez le numéro fiscal avant l'encaissement POS.", saveFirst: "Enregistrez d'abord le numéro fiscal, puis appliquez le modèle.", missing: "Aucun modèle national appliqué. Configurez-le, puis appliquez-le ici ou dans les paramètres POS avant l'encaissement.", stale: "Le modèle fiscal national a changé. Réappliquez-le ici ou dans les paramètres POS avant l'encaissement." }
      : { action: "Apply current country tax template", done: "Template applied. Check the tax registration number before POS checkout.", saveFirst: "Save the tax registration number before applying the template.", missing: "No country tax template is applied. Configure it first, then apply it here or in tenant POS settings before checkout.", stale: "The country tax template changed or no longer matches. Apply it here or in tenant POS settings before checkout." };
  const [form, setForm] = useState<SaasTenantTaxSettings | null>(null);
  const [savedTaxNumber, setSavedTaxNumber] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    webAdminApi.saas.tenants.getTaxSettings(tenantId)
      .then((data) => { if (active) { setForm(data); setSavedTaxNumber(data.taxRegistrationNumber); } })
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
      const updated = await webAdminApi.saas.tenants.updateTaxSettings(tenantId, {
        taxRegistrationNumber: form.taxRegistrationNumber,
        version: form.version,
      });
      setForm(updated);
      setSavedTaxNumber(updated.taxRegistrationNumber);
      setNotice(copy.saved);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function applyTemplate() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await webAdminApi.saas.tenants.applyTaxTemplate(tenantId, form.version);
      setForm(updated);
      setSavedTaxNumber(updated.taxRegistrationNumber);
      setNotice(applyCopy.done);
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
          <p className="text-xs text-muted-foreground">{copy.managed}</p>
          {templateApplied ? (
            <p className="text-sm">{copy.source}: {form.taxTemplateCountryCode} (v{form.taxTemplateVersion})</p>
          ) : (
            <p className="text-sm text-destructive" role="alert">{form.taxTemplateCountryCode ? applyCopy.stale : applyCopy.missing}</p>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted-foreground">{copy.enabled}</dt><dd>{form.taxEnabled ? copy.yes : copy.no}</dd></div>
            <div><dt className="text-muted-foreground">{copy.included}</dt><dd>{form.pricesIncludeTax ? copy.yes : copy.no}</dd></div>
            <div><dt className="text-muted-foreground">{copy.rate}</dt><dd>{new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(form.defaultTaxRate) * 100)}%</dd></div>
          </dl>
          <div className="grid gap-1"><Label htmlFor="saas-tax-number">{copy.number}</Label><Input disabled={!canEdit || saving} id="saas-tax-number" maxLength={200} onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value || null })} value={form.taxRegistrationNumber ?? ""} /></div>
          <Link className="text-sm text-primary underline-offset-4 hover:underline" href={webAdminRoutes.saas.config.platformSettingsSections.taxTemplates}>{copy.templates}</Link>
          {canEdit && !templateApplied ? <>
            <Button disabled={saving || form.taxRegistrationNumber !== savedTaxNumber} onClick={() => void applyTemplate()} size="sm" type="button" variant="outline">{applyCopy.action}</Button>
            {form.taxRegistrationNumber !== savedTaxNumber ? <p className="text-xs text-muted-foreground">{applyCopy.saveFirst}</p> : null}
          </> : null}
          {canEdit ? <Button disabled={saving} onClick={() => void save()} size="sm" type="button">{copy.save}</Button> : null}
        </> : null}
        {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
      </CardContent>
    </Card>
  );
}
