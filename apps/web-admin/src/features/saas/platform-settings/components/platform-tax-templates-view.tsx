"use client";

import type {
  PlatformTaxTemplate,
  UpsertPlatformTaxTemplateRequest,
} from "@cleanhub/api-client";
import {
  Button,
  Checkbox,
  Input,
  Label,
} from "@cleanhub/ui";
import { useEffect, useState } from "react";

import { useSaasI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

type TemplateRate = UpsertPlatformTaxTemplateRequest["rates"][number];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isImportTemplate(value: unknown): value is UpsertPlatformTaxTemplateRequest {
  return isObject(value) &&
    typeof value.countryCode === "string" &&
    typeof value.name === "string" &&
    typeof value.currencyCode === "string" &&
    typeof value.taxLabel === "string" &&
    (value.exemptionNotes === null || typeof value.exemptionNotes === "string") &&
    typeof value.taxEnabled === "boolean" &&
    typeof value.pricesIncludeTax === "boolean" &&
    Array.isArray(value.rates) && value.rates.length > 0 &&
    value.rates.every((rate: unknown) => isObject(rate) &&
      typeof rate.name === "string" && typeof rate.rate === "string" &&
      typeof rate.isDefault === "boolean" &&
      (rate.key === undefined || typeof rate.key === "string") &&
      (rate.components === undefined || (Array.isArray(rate.components) &&
        rate.components.every((part: unknown) => isObject(part) &&
          typeof part.name === "string" && typeof part.rate === "string"))));
}

const newRate = (): TemplateRate => ({
  name: "",
  rate: "",
  isDefault: true,
});

const emptyTemplate = (): UpsertPlatformTaxTemplateRequest => ({
  countryCode: "",
  name: "",
  currencyCode: "",
  taxLabel: "",
  exemptionNotes: null,
  taxEnabled: true,
  pricesIncludeTax: true,
  rates: [newRate()],
});

function templateToForm(template: PlatformTaxTemplate): UpsertPlatformTaxTemplateRequest {
  return {
    countryCode: template.countryCode,
    name: template.name,
    currencyCode: template.currencyCode ?? "",
    taxLabel: template.taxLabel ?? "",
    exemptionNotes: template.exemptionNotes,
    taxEnabled: template.taxEnabled,
    pricesIncludeTax: template.pricesIncludeTax,
    rates: template.rates.map(({ key, name, rate, isDefault, components }) => ({
      key,
      name,
      rate,
      isDefault,
      ...(components ? { components } : {}),
    })),
  };
}

const copy = {
  en: {
    title: "Country tax templates",
    hint: "Tenant owners select a country once. Later changes here update those tenants' future POS sales atomically; incompatible assigned tax classes block publication.",
    new: "New country",
    country: "ISO country code",
    name: "Country / template name",
    currency: "Currency (ISO 4217)",
    taxLabel: "Local tax name",
    exemptions: "Exemption guidance (informational only)",
    enabled: "Tax enabled",
    inclusive: "Prices include tax",
    rateName: "Tax class name",
    rate: "Total rate (fraction)",
    default: "Default",
    components: "Tax components",
    componentName: "Component name",
    componentRate: "Component rate (fraction)",
    addComponent: "Add component",
    addRate: "Add tax class",
    save: "Save template",
    saved: "Template saved",
    loadError: "Could not load templates",
    rateHint: "Enter fractions; each component must add up to its class's total rate.",
    importFile: "Choose template JSON",
    importAction: "Import configured countries",
    importReady: "countries ready to import",
    importInvalid: "The file must contain a JSON array of country tax templates.",
    importSuccess: "Country templates imported.",
    downloadTemplate: "Download JSON template",
    importHint: "Fill in a country using the form below, or download the JSON structure, complete each country's rates and upload it here. Review the preview before importing. Checkout stays blocked until the tenant applies the template and completes its tax registration number.",
  },
  fr: {
    title: "Modèles fiscaux par pays",
    hint: "Le propriétaire choisit un pays. Les changements suivants sont répercutés automatiquement sur les ventes futures; une catégorie utilisée mais supprimée bloque la publication.",
    new: "Nouveau pays",
    country: "Code pays ISO",
    name: "Nom du pays / modèle",
    currency: "Devise (ISO 4217)",
    taxLabel: "Nom local de la taxe",
    exemptions: "Indications d'exonération (informatives)",
    enabled: "Taxe activée",
    inclusive: "Prix TTC",
    rateName: "Nom de la catégorie",
    rate: "Taux total (fraction)",
    default: "Par défaut",
    components: "Composantes",
    componentName: "Nom de la composante",
    componentRate: "Taux de la composante",
    addComponent: "Ajouter une composante",
    addRate: "Ajouter une catégorie",
    save: "Enregistrer",
    saved: "Modèle enregistré",
    loadError: "Échec du chargement",
    rateHint: "Saisissez des fractions ; la somme des composantes doit égaler le taux total.",
    importFile: "Choisir le JSON des modèles",
    importAction: "Importer les pays",
    importReady: "pays prêts à importer",
    importInvalid: "Le fichier doit contenir un tableau JSON de modèles fiscaux.",
    importSuccess: "Modèles fiscaux importés.",
    downloadTemplate: "Télécharger le modèle JSON",
    importHint: "Saisissez un pays dans le formulaire ci-dessous, ou téléchargez la structure JSON, renseignez les taux de chaque pays et importez-la ici. Vérifiez l'aperçu avant de valider. L'encaissement reste bloqué jusqu'à l'application du modèle et la saisie du numéro fiscal.",
  },
  "zh-CN": {
    title: "国家税务模板",
    hint: "店主选择国家后，SaaS 修改会自动同步到该模板下的租户和后续 POS 交易；仍被商品使用的旧税类会阻止发布。",
    new: "新增国家",
    country: "国家代码（ISO 两位）",
    name: "国家／模板名称",
    currency: "货币代码（ISO 4217）",
    taxLabel: "当地税种名称",
    exemptions: "免税说明（仅供参考）",
    enabled: "启用税务",
    inclusive: "价格含税",
    rateName: "税类名称",
    rate: "总税率（小数）",
    default: "默认",
    components: "税种分项",
    componentName: "税种名称",
    componentRate: "分项税率（小数）",
    addComponent: "增加分项",
    addRate: "增加税类",
    save: "保存模板",
    saved: "模板已保存",
    loadError: "税务模板加载失败",
    rateHint: "以小数输入；分项税率之和必须等于该税类总税率。",
    importFile: "选择税务模板 JSON",
    importAction: "导入已配置国家",
    importReady: "个国家待导入",
    importInvalid: "文件必须是国家税务模板的 JSON 数组。",
    importSuccess: "国家税务模板已导入。",
    downloadTemplate: "下载 JSON 填写模板",
    importHint: "可使用下方表单逐国填写；也可下载 JSON 结构，填写各国税率后在此上传。导入前请核对预览。租户应用模板并填写税号前，POS 不允许结款。",
  },
} as const;

export function PlatformTaxTemplatesView() {
  const { locale } = useSaasI18n();
  const text = copy[locale];
  const [templates, setTemplates] = useState<PlatformTaxTemplate[]>([]);
  const [form, setForm] = useState<UpsertPlatformTaxTemplateRequest>(emptyTemplate);
  const [selectedCode, setSelectedCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingImport, setPendingImport] = useState<UpsertPlatformTaxTemplateRequest[]>([]);

  useEffect(() => {
    let active = true;
    webAdminApi.saas.platformSettings.listTaxTemplates()
      .then(({ data }) => {
        if (!active) return;
        setTemplates(data);
        if (data[0]) {
          setSelectedCode(data[0].countryCode);
          setForm(templateToForm(data[0]));
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : text.loadError);
      });
    return () => { active = false; };
  }, [text.loadError]);

  function updateRate(index: number, change: Partial<TemplateRate>) {
    setForm((current) => ({
      ...current,
      rates: current.rates.map((rate, position) =>
        position === index ? { ...rate, ...change } : rate),
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await webAdminApi.saas.platformSettings.upsertTaxTemplate(form);
      setTemplates((current) => [...current.filter((entry) => entry.countryCode !== updated.countryCode), updated]
        .sort((left, right) => left.countryCode.localeCompare(right.countryCode)));
      setSelectedCode(updated.countryCode);
      setForm(templateToForm(updated));
      setNotice(text.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function chooseImport(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isImportTemplate)) {
        throw new Error(text.importInvalid);
      }
      const codes = parsed.map((entry) => entry.countryCode);
      if (new Set(codes).size !== codes.length) throw new Error(text.importInvalid);
      setPendingImport(parsed);
    } catch (cause) {
      setPendingImport([]);
      setError(cause instanceof Error ? cause.message : text.importInvalid);
    }
  }

  async function importTemplates() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await webAdminApi.saas.platformSettings.importTaxTemplates(pendingImport);
      const importedCodes = new Set(data.map((entry) => entry.countryCode));
      setTemplates((current) => [...current.filter((entry) => !importedCodes.has(entry.countryCode)), ...data]
        .sort((left, right) => left.countryCode.localeCompare(right.countryCode)));
      setPendingImport([]);
      setNotice(text.importSuccess);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const content = JSON.stringify(
      templates.length > 0 ? templates.map(templateToForm) : [emptyTemplate()],
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cleanhub-country-tax-templates.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="space-y-5 rounded-xl border bg-background px-5 py-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">{text.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{text.hint}</p>
        <p className="mt-2 text-xs text-muted-foreground">{text.importHint}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b pb-5">
        <Button onClick={downloadTemplate} type="button" variant="outline">{text.downloadTemplate}</Button>
        <div className="grid gap-1.5">
          <Label htmlFor="tax-template-import">{text.importFile}</Label>
          <Input accept="application/json,.json" disabled={saving} id="tax-template-import" onChange={(event) => void chooseImport(event.target.files?.[0])} type="file" />
        </div>
        {pendingImport.length > 0 ? <Button disabled={saving} onClick={() => void importTemplates()} type="button">{text.importAction} ({pendingImport.length} {text.importReady})</Button> : null}
      </div>
      {pendingImport.length > 0 ? (
        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {pendingImport.map((entry) => (
            <div className="rounded-md border bg-background px-3 py-2" key={entry.countryCode}>
              <strong>{entry.countryCode} · {entry.name}</strong>
              <p className="text-muted-foreground">{entry.currencyCode} · {entry.taxLabel} · {entry.rates.find((rate) => rate.isDefault)?.rate}</p>
              {entry.rates.find((rate) => rate.isDefault)?.components?.length ? (
                <p className="text-muted-foreground">{entry.rates.find((rate) => rate.isDefault)?.components?.map((part) => `${part.name} ${part.rate}`).join(" + ")}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {templates.map((entry) => (
          <Button
            key={entry.countryCode}
            onClick={() => {
              setSelectedCode(entry.countryCode);
              setForm(templateToForm(entry));
              setError("");
              setNotice("");
            }}
            size="sm"
            type="button"
            variant={selectedCode === entry.countryCode ? "default" : "outline"}
          >
            {entry.countryCode} · {entry.name}
          </Button>
        ))}
        <Button onClick={() => { setSelectedCode(""); setForm(emptyTemplate()); setError(""); setNotice(""); }} size="sm" type="button" variant="outline">
          {text.new}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tax-country">{text.country}</Label>
          <Input id="tax-country" maxLength={2} onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })} readOnly={Boolean(selectedCode)} value={form.countryCode} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tax-template-name">{text.name}</Label>
          <Input id="tax-template-name" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tax-currency">{text.currency}</Label>
          <Input id="tax-currency" maxLength={3} onChange={(event) => setForm({ ...form, currencyCode: event.target.value.toUpperCase() })} value={form.currencyCode ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tax-label">{text.taxLabel}</Label>
          <Input id="tax-label" maxLength={80} onChange={(event) => setForm({ ...form, taxLabel: event.target.value })} value={form.taxLabel ?? ""} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="tax-exemptions">{text.exemptions}</Label>
          <Input id="tax-exemptions" maxLength={2000} onChange={(event) => setForm({ ...form, exemptionNotes: event.target.value || null })} value={form.exemptionNotes ?? ""} />
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={form.taxEnabled} onCheckedChange={(value) => setForm({ ...form, taxEnabled: value === true })} />{text.enabled}</label>
        <label className="flex items-center gap-2"><Checkbox checked={form.pricesIncludeTax} onCheckedChange={(value) => setForm({ ...form, pricesIncludeTax: value === true })} />{text.inclusive}</label>
      </div>
      <p className="text-xs text-muted-foreground">{text.rateHint}</p>
      <div className="space-y-4">
        {form.rates.map((rate, index) => (
          <div className="space-y-3 rounded-lg border p-4" key={index}>
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_140px_85px_72px]">
              <div className="grid gap-1"><Label>{text.rateName}</Label><Input onChange={(event) => updateRate(index, { name: event.target.value })} value={rate.name} /></div>
              <div className="grid gap-1"><Label>{text.rate}</Label><Input inputMode="decimal" onChange={(event) => updateRate(index, { rate: event.target.value })} value={rate.rate} /></div>
              <label className="flex h-9 items-center gap-2 text-xs"><input checked={rate.isDefault} name="default-tax-rate" onChange={() => setForm({ ...form, rates: form.rates.map((entry, position) => ({ ...entry, isDefault: position === index, components: position === index ? entry.components : undefined })) })} type="radio" />{text.default}</label>
              <Button disabled={form.rates.length === 1} onClick={() => {
                const next = form.rates.filter((_, position) => position !== index);
                if (!next.some((entry) => entry.isDefault)) next[0] = { ...next[0], isDefault: true };
                setForm({ ...form, rates: next });
              }} size="sm" type="button" variant="outline">×</Button>
            </div>
            {rate.components?.length ? (
              <div className="space-y-2 border-l pl-4">
                <p className="text-xs font-medium">{text.components}</p>
                {rate.components.map((component, componentIndex) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_72px]" key={componentIndex}>
                    <Input aria-label={text.componentName} onChange={(event) => updateRate(index, { components: rate.components!.map((entry, position) => position === componentIndex ? { ...entry, name: event.target.value } : entry) })} placeholder={text.componentName} value={component.name} />
                    <Input aria-label={text.componentRate} inputMode="decimal" onChange={(event) => updateRate(index, { components: rate.components!.map((entry, position) => position === componentIndex ? { ...entry, rate: event.target.value } : entry) })} placeholder={text.componentRate} value={component.rate} />
                    <Button onClick={() => {
                      const remaining = rate.components!.filter((_, position) => position !== componentIndex);
                      updateRate(index, { components: remaining.length > 0 ? remaining : undefined });
                    }} size="sm" type="button" variant="outline">×</Button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button disabled={!rate.isDefault || (rate.components?.length ?? 0) >= 10} onClick={() => updateRate(index, { components: [...(rate.components ?? []), { name: "", rate: "" }] })} size="sm" type="button" variant="outline">
              {text.addComponent}
            </Button>
          </div>
        ))}
        <Button disabled={form.rates.length >= 20} onClick={() => setForm({ ...form, rates: [...form.rates, { ...newRate(), isDefault: false }] })} size="sm" type="button" variant="outline">
          {text.addRate}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      <Button disabled={saving} onClick={() => void save()} size="sm" type="button">{text.save}</Button>
    </section>
  );
}
