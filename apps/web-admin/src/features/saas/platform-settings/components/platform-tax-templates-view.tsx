"use client";

import type { PlatformTaxTemplate, UpsertPlatformTaxTemplateRequest } from "@cleanhub/api-client";
import { Button, Checkbox, Input, Label } from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { useSaasI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

const emptyTemplate = (): UpsertPlatformTaxTemplateRequest => ({
  countryCode: "",
  name: "",
  taxEnabled: true,
  pricesIncludeTax: true,
  rates: [{ name: "Standard", rate: "0.1800", isDefault: true }],
});

export function PlatformTaxTemplatesView() {
  const { locale } = useSaasI18n();
  const copy = locale === "zh-CN"
    ? { title: "国家税务模板", hint: "创建租户时按国家带入，之后店主可以调整。税率填小数：0.18 表示 18%。", new: "新增国家", country: "国家代码（ISO 两位）", name: "模板名称", enabled: "启用税务", inclusive: "价格含税", rateName: "税类名称", rate: "税率（小数）", default: "默认", addRate: "增加税类", save: "保存模板", saved: "模板已保存", loadError: "税务模板加载失败" }
    : locale === "fr"
      ? { title: "Modèles fiscaux par pays", hint: "Appliqués à la création du locataire; le propriétaire peut ensuite les modifier. Saisir 0.18 pour 18 %.", new: "Nouveau pays", country: "Code pays ISO", name: "Nom du modèle", enabled: "Taxe activée", inclusive: "Prix TTC", rateName: "Nom du taux", rate: "Taux (fraction)", default: "Par défaut", addRate: "Ajouter un taux", save: "Enregistrer", saved: "Modèle enregistré", loadError: "Échec du chargement" }
      : { title: "Country tax templates", hint: "Applied when a tenant is created; the owner may change them later. Enter fractions: 0.18 means 18%.", new: "New country", country: "ISO country code", name: "Template name", enabled: "Tax enabled", inclusive: "Prices include tax", rateName: "Rate name", rate: "Rate (fraction)", default: "Default", addRate: "Add rate", save: "Save template", saved: "Template saved", loadError: "Could not load templates" };
  const [templates, setTemplates] = useState<PlatformTaxTemplate[]>([]);
  const [form, setForm] = useState<UpsertPlatformTaxTemplateRequest>(emptyTemplate);
  const [selectedCode, setSelectedCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    webAdminApi.saas.platformSettings.listTaxTemplates()
      .then(({ data }) => {
        if (!active) return;
        setTemplates(data);
        if (data[0]) {
          setSelectedCode(data[0].countryCode);
          setForm(data[0]);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : copy.loadError);
      });
    return () => { active = false; };
  }, [copy.loadError]);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await webAdminApi.saas.platformSettings.upsertTaxTemplate(form);
      setTemplates((current) => [...current.filter((entry) => entry.countryCode !== updated.countryCode), updated]
        .sort((a, b) => a.countryCode.localeCompare(b.countryCode)));
      setSelectedCode(updated.countryCode);
      setForm(updated);
      setNotice(copy.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-background px-5 py-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((entry) => (
          <Button key={entry.countryCode} onClick={() => {
            setSelectedCode(entry.countryCode);
            setForm(entry);
            setError("");
          }} size="sm" type="button" variant={selectedCode === entry.countryCode ? "default" : "outline"}>
            {entry.countryCode} · {entry.name}
          </Button>
        ))}
        <Button onClick={() => { setSelectedCode(""); setForm(emptyTemplate()); setError(""); }} size="sm" type="button" variant="outline">{copy.new}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="tax-country">{copy.country}</Label><Input id="tax-country" maxLength={2} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} readOnly={Boolean(selectedCode)} value={form.countryCode} /></div>
        <div className="grid gap-1.5"><Label htmlFor="tax-template-name">{copy.name}</Label><Input id="tax-template-name" onChange={(e) => setForm({ ...form, name: e.target.value })} value={form.name} /></div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={form.taxEnabled} onCheckedChange={(v) => setForm({ ...form, taxEnabled: v === true })} />{copy.enabled}</label>
        <label className="flex items-center gap-2"><Checkbox checked={form.pricesIncludeTax} onCheckedChange={(v) => setForm({ ...form, pricesIncludeTax: v === true })} />{copy.inclusive}</label>
      </div>
      <div className="space-y-2">
        {form.rates.map((rate, index) => (
          <div className="grid items-end gap-2 sm:grid-cols-[1fr_140px_85px_72px]" key={index}>
            <div className="grid gap-1"><Label>{copy.rateName}</Label><Input onChange={(e) => setForm({ ...form, rates: form.rates.map((value, i) => i === index ? { ...value, name: e.target.value } : value) })} value={rate.name} /></div>
            <div className="grid gap-1"><Label>{copy.rate}</Label><Input inputMode="decimal" onChange={(e) => setForm({ ...form, rates: form.rates.map((value, i) => i === index ? { ...value, rate: e.target.value } : value) })} value={rate.rate} /></div>
            <label className="flex h-9 items-center gap-2 text-xs"><input checked={rate.isDefault} name="default-tax-rate" onChange={() => setForm({ ...form, rates: form.rates.map((value, i) => ({ ...value, isDefault: i === index })) })} type="radio" />{copy.default}</label>
            <Button disabled={form.rates.length === 1} onClick={() => {
              const next = form.rates.filter((_, i) => i !== index);
              if (!next.some((value) => value.isDefault)) next[0] = { ...next[0], isDefault: true };
              setForm({ ...form, rates: next });
            }} size="sm" type="button" variant="outline">×</Button>
          </div>
        ))}
        <Button disabled={form.rates.length >= 20} onClick={() => setForm({ ...form, rates: [...form.rates, { name: "", rate: "0.0000", isDefault: false }] })} size="sm" type="button" variant="outline">{copy.addRate}</Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      <Button disabled={saving} onClick={() => void save()} size="sm" type="button">{copy.save}</Button>
    </section>
  );
}
