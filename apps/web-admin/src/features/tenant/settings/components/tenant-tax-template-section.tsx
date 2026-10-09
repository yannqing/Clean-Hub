"use client";

import type { PlatformTaxTemplate } from "@cleanhub/api-client";
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import { Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTenantI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

function normalizeCountry(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z]/g, "");
}

const copy = {
  en: {
    title: "Country tax template",
    description: "Apply the SaaS-managed template for this tenant's country to future POS sales. Existing orders keep their saved tax amounts.",
    choose: "Choose a country",
    apply: "Apply template",
    applying: "Applying…",
    applied: "Country tax template applied.",
    empty: "No ready template matches this tenant's country. Ask a SaaS administrator to configure the country and its tax template.",
    readOnly: "Read only",
    currency: "Currency",
    label: "Local tax name",
    exemptions: "Exemption guidance",
    currencyNote: "Applying a template does not change the store currency or existing item prices.",
    loadError: "Could not load country tax templates.",
    current: "Applied template",
    updateAvailable: "SaaS has published a newer version. Refresh this page to see the synchronized settings.",
    checkoutBlocked: "Checkout is unavailable until this country template is applied and the POS tax registration number is completed.",
    registrationMissing: "Checkout is unavailable until the owner enables tax and enters the tax registration number in POS settings.",
  },
  fr: {
    title: "Modèle fiscal du pays",
    description: "Appliquez le modèle SaaS du pays de ce locataire aux prochaines ventes POS. Les anciennes commandes conservent leurs montants.",
    choose: "Choisir un pays",
    apply: "Appliquer le modèle",
    applying: "Application…",
    applied: "Modèle fiscal appliqué.",
    empty: "Aucun modèle prêt ne correspond au pays du locataire. Demandez à l'administrateur SaaS de configurer le pays et sa fiscalité.",
    readOnly: "Lecture seule",
    currency: "Devise",
    label: "Nom local de la taxe",
    exemptions: "Indications d'exonération",
    currencyNote: "Le modèle ne change ni la devise du magasin ni les prix existants.",
    loadError: "Chargement des modèles fiscaux impossible.",
    current: "Modèle appliqué",
    updateAvailable: "Une nouvelle version SaaS est disponible. Actualisez cette page pour voir les paramètres synchronisés.",
    checkoutBlocked: "L'encaissement est indisponible tant que ce modèle n'est pas appliqué et que le numéro fiscal POS n'est pas renseigné.",
    registrationMissing: "L'encaissement est indisponible tant que le propriétaire n'active pas la taxe et ne renseigne pas le numéro fiscal dans les paramètres POS.",
  },
  "zh-CN": {
    title: "国家税务模板",
    description: "应用与租户国家一致的 SaaS 税务模板，后续 POS 交易采用新税率；历史订单税额保持原样。",
    choose: "选择国家",
    apply: "应用模板",
    applying: "应用中…",
    applied: "国家税务模板已应用。",
    empty: "租户国家尚无可用税务模板，请联系 SaaS 管理员配置国家及其税务模板。",
    readOnly: "只读",
    currency: "货币",
    label: "当地税种名称",
    exemptions: "免税说明",
    currencyNote: "应用模板不会更改门店货币或已有商品价格。",
    loadError: "无法加载国家税务模板。",
    current: "当前已应用模板",
    updateAvailable: "SaaS 已发布新版本；刷新页面即可查看同步后的设置。",
    checkoutBlocked: "应用国家模板并在 POS 设置中填写税务登记号之前，收银结款不可用。",
    registrationMissing: "请在下方 POS 税务设置中启用税务并填写税务登记号；完成前收银结款不可用。",
  },
} as const;

export function TenantTaxTemplateSection({
  canManage,
  tenantCountry,
  settingsVersion,
  appliedCountryCode,
  appliedTemplateVersion,
  taxEnabled,
  taxRegistrationNumber,
}: {
  canManage: boolean;
  tenantCountry: string | null;
  settingsVersion?: number;
  appliedCountryCode?: string | null;
  appliedTemplateVersion?: number | null;
  taxEnabled?: boolean;
  taxRegistrationNumber?: string | null;
}) {
  const { locale } = useTenantI18n();
  const text = copy[locale];
  const router = useRouter();
  const [templates, setTemplates] = useState<PlatformTaxTemplate[]>([]);
  const [countryCode, setCountryCode] = useState(appliedCountryCode ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(settingsVersion);
  const [currentAppliedCountry, setAppliedCountry] = useState(appliedCountryCode);
  const [currentAppliedVersion, setAppliedVersion] = useState(appliedTemplateVersion);
  const selected = templates.find((item) => item.countryCode === countryCode);
  const appliedTemplate = templates.find((item) => item.countryCode === currentAppliedCountry);
  const appliedOutdated = Boolean(!loading && currentAppliedCountry &&
    (!appliedTemplate || currentAppliedVersion !== appliedTemplate.version));

  useEffect(() => {
    let active = true;
    webAdminApi.tenant.taxRates.listTemplates()
      .then(({ data }) => {
        if (active) {
          const normalizedCountry = normalizeCountry(tenantCountry ?? "");
          const available = data.filter((template) =>
            normalizedCountry !== "" && (
              normalizeCountry(template.countryCode) === normalizedCountry ||
              normalizeCountry(template.name) === normalizedCountry ||
              normalizeCountry(template.name.split(/\s[-–—]\s/, 1)[0] ?? "") === normalizedCountry ||
              (template.countryCode === "CI" && normalizedCountry === "ivorycoast")
            ),
          );
          setTemplates(available);
          setCountryCode((current) =>
            available.some((template) => template.countryCode === current)
              ? current
              : available[0]?.countryCode ?? "",
          );
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : text.loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [tenantCountry, text.loadError]);

  async function apply() {
    if (!selected || currentVersion === undefined) return;
    setApplying(true);
    setError("");
    try {
      const result = await webAdminApi.tenant.taxRates.applyTemplate({
        countryCode: selected.countryCode,
        templateVersion: selected.version,
        settingsVersion: currentVersion,
      });
      setCurrentVersion(result.settingsVersion);
      setAppliedCountry(result.template.countryCode);
      setAppliedVersion(result.template.version);
      toast.success(text.applied);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : text.loadError;
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="px-4 py-5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Globe2 aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-slate-950">{text.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{text.description}</p>
          <div className="mt-4 flex max-w-xl flex-wrap items-center gap-3">
            <Select onValueChange={setCountryCode} value={countryCode}>
              <SelectTrigger className="min-w-56 max-w-80"><SelectValue placeholder={text.choose} /></SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.countryCode} value={template.countryCode}>
                    {template.name} ({template.countryCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage ? (
              <Button disabled={!selected || currentVersion === undefined || applying || (currentAppliedCountry === selected?.countryCode && currentAppliedVersion === selected?.version)} onClick={() => void apply()} size="sm" type="button">
                {applying ? text.applying : text.apply}
              </Button>
            ) : <Badge variant="outline">{text.readOnly}</Badge>}
          </div>
          {!currentAppliedCountry || appliedOutdated ? (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950" role="alert">{text.checkoutBlocked}</p>
          ) : null}
          {currentAppliedCountry && (!taxEnabled || !taxRegistrationNumber?.trim()) ? (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950" role="alert">{text.registrationMissing}</p>
          ) : null}
          {selected ? (
            <div className="mt-4 grid gap-2 text-xs text-slate-600">
              {currentAppliedCountry === selected.countryCode ? <p><Badge variant="outline">{text.current} v{currentAppliedVersion ?? "—"}</Badge></p> : null}
              {currentAppliedCountry === selected.countryCode && currentAppliedVersion !== null && currentAppliedVersion !== undefined && selected.version > currentAppliedVersion ? <p className="text-amber-700">{text.updateAvailable}</p> : null}
              <p>{text.currency}: {selected.currencyCode ?? "—"} · {text.label}: {selected.taxLabel ?? "—"}</p>
              <p>{selected.rates.map((rate) => `${rate.name}: ${(Number(rate.rate) * 100).toLocaleString(locale)}%`).join(" · ")}</p>
              {selected.exemptionNotes ? <p>{text.exemptions}: {selected.exemptionNotes}</p> : null}
              <p>{text.currencyNote}</p>
            </div>
          ) : null}
          {!loading && templates.length === 0 && !error ? <p className="mt-3 text-xs text-slate-500">{text.empty}</p> : null}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
