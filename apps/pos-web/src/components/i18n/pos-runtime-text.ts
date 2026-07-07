import type { SupportedLocale } from "@cleanhub/i18n";

import {
  POS_TEXT_TRANSLATIONS,
  type PosTextLocale,
} from "./pos-text-translations";

const HAN_RE = /[\u3400-\u9fff]/;

const POS_TEXT_TRANSLATION_OVERRIDES: Record<
  string,
  Record<PosTextLocale, string>
> = {
  "业务记录": { en: "Business records", fr: "Dossiers" },
  "共": { en: "Total", fr: "Total" },
  "条": { en: "items", fr: "éléments" },
  "第": { en: "Page", fr: "Page" },
  "页": { en: "page", fr: "page" },
  "个工单": { en: "tickets", fr: "tickets" },
  "个项目": { en: "items", fr: "articles" },
  "个客户档案": { en: "customer profiles", fr: "profils client" },
  "件": { en: "items", fr: "articles" },
  "保存": { en: "Save", fr: "Enregistrer" },
  "保存中…": { en: "Saving...", fr: "Enregistrement..." },
  "取消": { en: "Cancel", fr: "Annuler" },
  "删除": { en: "Delete", fr: "Supprimer" },
  "编辑": { en: "Edit", fr: "Modifier" },
  "重置": { en: "Reset", fr: "Réinitialiser" },
  "查询": { en: "Search", fr: "Rechercher" },
  "加载中…": { en: "Loading...", fr: "Chargement..." },
  "加载中...": { en: "Loading...", fr: "Chargement..." },
  "上一页": { en: "Previous", fr: "Précédent" },
  "下一页": { en: "Next", fr: "Suivant" },
  "每页": { en: "Per page", fr: "Par page" },
  "操作": { en: "Actions", fr: "Actions" },
  "状态": { en: "Status", fr: "Statut" },
  "类型": { en: "Type", fr: "Type" },
  "优先级": { en: "Priority", fr: "Priorité" },
  "来源": { en: "Source", fr: "Source" },
  "支付": { en: "Payment", fr: "Paiement" },
  "金额": { en: "Amount", fr: "Montant" },
  "备注": { en: "Notes", fr: "Notes" },
  "日期": { en: "Date", fr: "Date" },
  "客户": { en: "Customer", fr: "Client" },
  "订单": { en: "Order", fr: "Commande" },
  "工单": { en: "Ticket", fr: "Ticket" },
  "项目": { en: "Item", fr: "Article" },
  "服务": { en: "Service", fr: "Service" },
  "草稿": { en: "Draft", fr: "Brouillon" },
  "待处理": { en: "Pending", fr: "En attente" },
  "处理中": { en: "In progress", fr: "En cours" },
  "待取件": { en: "Ready for pickup", fr: "Prêt à récupérer" },
  "已取件": { en: "Picked up", fr: "Récupéré" },
  "已取消": { en: "Cancelled", fr: "Annulé" },
  "异常": { en: "Exception", fr: "Exception" },
  "已完成": { en: "Completed", fr: "Terminé" },
  "已支付": { en: "Paid", fr: "Payé" },
  "未支付": { en: "Unpaid", fr: "Non payé" },
  "部分支付": { en: "Partially paid", fr: "Partiellement payé" },
  "已退款": { en: "Refunded", fr: "Remboursé" },
  "已交付": { en: "Delivered", fr: "Livré" },
  "已逾期": { en: "Overdue", fr: "En retard" },
  "今日销售额": { en: "Today's sales", fr: "Ventes du jour" },
  "今日订单": { en: "Today's orders", fr: "Commandes du jour" },
  "今日新增": { en: "New today", fr: "Nouveaux aujourd'hui" },
  "今日取件": { en: "Picked up today", fr: "Retraits du jour" },
  "统计数据": { en: "Statistics", fr: "Statistiques" },
  "订单统计": { en: "Order statistics", fr: "Statistiques commandes" },
  "工单统计": { en: "Ticket statistics", fr: "Statistiques tickets" },
  "客户统计": { en: "Customer statistics", fr: "Statistiques clients" },
  "工单状态分布": {
    en: "Ticket status distribution",
    fr: "Répartition des statuts",
  },
};

const POS_TEXT_TRANSLATION_DICTIONARY = {
  ...POS_TEXT_TRANSLATIONS,
  ...POS_TEXT_TRANSLATION_OVERRIDES,
};

let runtimeLocale: SupportedLocale = "zh-CN";

export function setPosRuntimeLocale(locale: SupportedLocale): void {
  runtimeLocale = locale;
}

export function getPosRuntimeLocale(): SupportedLocale {
  return runtimeLocale;
}

export function translatePosText(
  value: string,
  locale: SupportedLocale = runtimeLocale,
): string {
  if (locale === "zh-CN" || !HAN_RE.test(value)) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized || !HAN_RE.test(normalized)) {
    return value;
  }

  const targetLocale = locale as PosTextLocale;
  const exact = POS_TEXT_TRANSLATION_DICTIONARY[normalized]?.[targetLocale];

  if (exact) {
    return `${leading}${exact}${trailing}`;
  }

  let translated = normalized;
  for (const [source, translations] of getPhraseEntries(targetLocale)) {
    translated = translated.split(source).join(translations);
  }

  return `${leading}${translated}${trailing}`;
}

function getPhraseEntries(locale: PosTextLocale): Array<readonly [string, string]> {
  return Object.entries(POS_TEXT_TRANSLATION_DICTIONARY)
    .filter(([source]) => HAN_RE.test(source))
    .sort(([left], [right]) => right.length - left.length)
    .map(([source, translations]) => [source, translations[locale]] as const);
}
