"use client";

import type { TenantCheckoutReadiness } from "@cleanhub/api-client";
import { Badge, Button, Card, CardContent } from "@cleanhub/ui";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";

const messages = {
  "zh-CN": {
    title: "开店就绪检查", ready: "已具备收银条件", pending: "准备中，暂不可收银",
    hint: "创建租户不代表已可收银。至少一个门店须同时满足目录、终端和税务条件。完成配置后，请在 POS 同步；仅点击同步不能补齐后台缺项。",
    active: "租户已启用", owner: "有效店主账号", branch: "营业门店", catalog: "可销售的商品或服务", terminal: "已绑定终端",
    country: "经营国家", template: "可用的国家税务模板", applied: "已应用当前模板", tax: "税务已启用且有税务名称", number: "税务登记号", currency: "租户币种与模板一致",
    fix: "去完善", done: "已完成", missing: "待完善", countryHelp: "由 SaaS 管理员填写实际经营国家。", templateHelp: "由 SaaS 管理员填写或上传国家税务模板。",
    taxHelp: "由店主、经理或 SaaS 管理员填写税号并应用当前模板。", branchHelp: "由店主或经理建立门店、目录并绑定终端。",
    currencyHelp: "门店币种须与国家模板一致；已有金额数据时须按迁移流程处理。", branchSummary: "门店收银条件", branchPending: "该门店尚未就绪", retry: "重新检查",
  },
  en: {
    title: "Store readiness", ready: "Ready for checkout", pending: "Setup incomplete · checkout unavailable",
    hint: "Creating a tenant does not enable checkout. At least one branch needs a sellable catalogue, an enrolled terminal and complete tax settings. Sync the POS after setup; syncing alone cannot fill missing server settings.",
    active: "Tenant enabled", owner: "Active owner account", branch: "Active branch", catalog: "Sellable product or service", terminal: "Enrolled terminal",
    country: "Operating country", template: "Usable country tax template", applied: "Current template applied", tax: "Tax enabled with a tax label", number: "Tax registration number", currency: "Tenant currency matches the template",
    fix: "Complete setup", done: "Complete", missing: "Missing", countryHelp: "A SaaS administrator must set the actual operating country.", templateHelp: "A SaaS administrator must complete or upload the country tax template.",
    taxHelp: "An owner, manager or SaaS administrator must enter the tax number and apply the current template.", branchHelp: "An owner or manager must create a branch and catalogue, then enroll a terminal.",
    currencyHelp: "Branch currency must match the country template. Existing monetary data requires a migration.", branchSummary: "Checkout conditions by branch", branchPending: "This branch is not ready", retry: "Check again",
  },
  fr: {
    title: "Préparation du magasin", ready: "Prêt pour l’encaissement", pending: "Configuration incomplète · encaissement indisponible",
    hint: "Créer un locataire ne suffit pas pour encaisser. Au moins un magasin doit avoir un catalogue vendable, un terminal inscrit et une fiscalité complète. Synchronisez ensuite le POS ; la synchronisation seule ne complète pas les paramètres manquants.",
    active: "Locataire activé", owner: "Propriétaire actif", branch: "Magasin actif", catalog: "Produit ou service vendable", terminal: "Terminal inscrit",
    country: "Pays d’activité", template: "Modèle fiscal national utilisable", applied: "Modèle actuel appliqué", tax: "Taxe activée et nom renseigné", number: "Numéro fiscal", currency: "Devise du locataire conforme au modèle",
    fix: "Compléter", done: "Complet", missing: "À compléter", countryHelp: "Un administrateur SaaS doit renseigner le pays d’activité réel.", templateHelp: "Un administrateur SaaS doit remplir ou importer le modèle fiscal national.",
    taxHelp: "Le propriétaire, le responsable ou un administrateur SaaS doit saisir le numéro fiscal et appliquer le modèle actuel.", branchHelp: "Le propriétaire ou responsable doit créer le magasin et le catalogue, puis inscrire un terminal.",
    currencyHelp: "La devise du magasin doit correspondre au modèle national. Les montants existants exigent une migration.", branchSummary: "Conditions par magasin", branchPending: "Ce magasin n’est pas prêt", retry: "Vérifier à nouveau",
  },
} as const;

export function CheckoutReadinessCard({ readiness, locale, tenantId, onRefresh }: {
  readiness: TenantCheckoutReadiness;
  locale: string;
  /** Present in SaaS. Tenant users only receive links within their own console. */
  tenantId?: string;
  onRefresh?: () => void;
}) {
  const m = messages[locale as keyof typeof messages] ?? messages.en;
  const saas = Boolean(tenantId);
  const countryHref = saas ? "#tenant-country" : undefined;
  const taxHref = saas ? "#tenant-tax-settings" : webAdminRoutes.tenant.system.settingsSections.pointOfSale;
  const templateHref = saas ? webAdminRoutes.saas.config.platformSettingsSections.taxTemplates : taxHref;
  const branchHref = saas ? undefined : webAdminRoutes.tenant.branches;
  const checks = readiness.taxReadiness.checks;
  const items = [
    { label: m.active, ready: readiness.tenantActive, href: saas ? "#tenant-status" : undefined },
    { label: m.country, ready: checks.countrySet, href: countryHref, hint: m.countryHelp },
    { label: m.template, ready: checks.templateAvailable, href: templateHref, hint: m.templateHelp },
    { label: m.applied, ready: checks.templateApplied, href: taxHref, hint: m.taxHelp },
    { label: m.tax, ready: checks.taxEnabled && checks.taxLabelSet, href: taxHref, hint: m.taxHelp },
    { label: m.number, ready: checks.taxRegistrationNumberSet, href: taxHref, hint: m.taxHelp },
    { label: m.currency, ready: checks.currencyMatches, href: countryHref, hint: m.currencyHelp },
    { label: m.owner, ready: readiness.activeOwnerCount > 0, href: saas ? webAdminRoutes.saas.users : webAdminRoutes.tenant.users, hint: m.branchHelp },
    { label: m.branch, ready: readiness.activeBranchCount > 0, href: branchHref, hint: m.branchHelp },
    { label: m.catalog, ready: readiness.activeCatalogItemCount > 0, href: saas ? undefined : webAdminRoutes.tenant.services, hint: m.branchHelp },
    { label: m.terminal, ready: readiness.enrolledTerminalCount > 0, href: saas ? undefined : webAdminRoutes.tenant.pointOfSale.devices, hint: m.branchHelp },
  ];
  return (
    <Card className="gap-0 rounded-xl py-0 shadow-none" data-testid="checkout-readiness">
      <CardContent className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{m.title}</h2>
          <div className="flex items-center gap-2">
            <Badge variant={readiness.ready ? "default" : "secondary"}>{readiness.ready ? m.ready : m.pending}</Badge>
            {onRefresh ? <Button size="sm" type="button" variant="outline" onClick={onRefresh}>{m.retry}</Button> : null}
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{m.hint}</p>
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <div className="rounded-lg border px-3 py-2" key={item.label}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{item.label}</span>
                {item.ready ? <span className="text-emerald-700">✓ {m.done}</span> : item.href ? <Link className="shrink-0 text-primary underline underline-offset-2" href={item.href}>{m.fix}</Link> : <span className="text-muted-foreground">{m.missing}</span>}
              </div>
              {!item.ready && item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
            </div>
          ))}
        </div>
        {readiness.branches.length > 0 ? <div className="grid gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{m.branchSummary}</h3>
          {readiness.branches.map((branch) => <div className="rounded-lg bg-muted/30 p-3 text-xs" key={branch.id}>
            <div className="flex items-center justify-between gap-2"><span className="font-medium">{branch.name} · {branch.currency}</span><span>{branch.ready ? m.ready : m.branchPending}</span></div>
            {!branch.ready ? <p className="mt-1 text-muted-foreground">{[
              !branch.catalogReady && m.catalog,
              branch.enrolledTerminalCount === 0 && m.terminal,
              !branch.taxReadiness.checks.currencyMatches && m.currencyHelp,
              !branch.taxReadiness.ready && m.taxHelp,
            ].filter(Boolean).join(" · ")}</p> : null}
          </div>)}
        </div> : null}
      </CardContent>
    </Card>
  );
}
