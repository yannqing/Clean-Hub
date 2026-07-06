"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import {
  POS_DOM_TRANSLATIONS,
  type PosDomLocale,
} from "./pos-dom-translations";

const TRANSLATABLE_ATTRIBUTES = [
  "aria-label",
  "alt",
  "placeholder",
  "title",
] as const;

const SKIP_ELEMENT_TAGS = new Set([
  "CODE",
  "IFRAME",
  "NOSCRIPT",
  "PRE",
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
]);
const SKIP_SELECTOR = "[data-pos-i18n-managed='true']";

const HAN_RE = /[\u3400-\u9fff]/;
const ROUTE_MUTATION_TRANSLATION_DELAY_MS = 800;

const POS_DOM_TRANSLATION_OVERRIDES: Record<
  string,
  Record<PosDomLocale, string>
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
  "工单状态分布": { en: "Ticket status distribution", fr: "Répartition des statuts" },
};

const POS_DOM_TRANSLATION_DICTIONARY = {
  ...POS_DOM_TRANSLATIONS,
  ...POS_DOM_TRANSLATION_OVERRIDES,
};

type AttributeOriginals = Partial<Record<(typeof TRANSLATABLE_ATTRIBUTES)[number], string>>;

export function PosDomLocalizer() {
  const { locale } = useTranslation();
  const textOriginalsRef = useRef(new WeakMap<Text, string>());
  const attributeOriginalsRef = useRef(new WeakMap<Element, AttributeOriginals>());

  const phraseEntries = useMemo(() => {
    if (locale === "zh-CN") {
      return [];
    }

    return Object.entries(POS_DOM_TRANSLATION_DICTIONARY)
      .filter(([source]) => HAN_RE.test(source))
      .sort(([left], [right]) => right.length - left.length)
      .map(([source, translations]) => [
        source,
        translations[locale as PosDomLocale],
      ] as const);
  }, [locale]);

  useEffect(() => {
    const textOriginals = textOriginalsRef.current;
    const attributeOriginals = attributeOriginalsRef.current;

    function shouldSkipNode(node: Node): boolean {
      const parent =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;

      if (!parent) {
        return false;
      }

      return Boolean(
        parent.closest([...SKIP_ELEMENT_TAGS].join(",")) ||
          parent.closest(SKIP_SELECTOR),
      );
    }

    function translateTextValue(value: string): string {
      const leading = value.match(/^\s*/)?.[0] ?? "";
      const trailing = value.match(/\s*$/)?.[0] ?? "";
      const normalized = value.replace(/\s+/g, " ").trim();

      if (!normalized || !HAN_RE.test(normalized)) {
        return value;
      }

      if (locale === "zh-CN") {
        return value;
      }

      const exact =
        POS_DOM_TRANSLATION_DICTIONARY[normalized]?.[locale as PosDomLocale];

      if (exact) {
        return `${leading}${exact}${trailing}`;
      }

      let translated = normalized;
      for (const [source, replacement] of phraseEntries) {
        translated = translated.split(source).join(replacement);
      }

      return `${leading}${translated}${trailing}`;
    }

    function localizeTextNode(node: Text): void {
      const current = node.nodeValue ?? "";

      if (!textOriginals.has(node) && HAN_RE.test(current)) {
        textOriginals.set(node, current);
      }

      const original = textOriginals.get(node);
      if (!original) {
        return;
      }

      node.nodeValue =
        locale === "zh-CN" ? original : translateTextValue(original);
    }

    function localizeElementAttributes(element: Element): void {
      let originals = attributeOriginals.get(element);

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        if (!current) {
          continue;
        }

        if (!originals?.[attribute] && HAN_RE.test(current)) {
          originals = { ...originals, [attribute]: current };
          attributeOriginals.set(element, originals);
        }

        const original = originals?.[attribute];
        if (!original) {
          continue;
        }

        element.setAttribute(
          attribute,
          locale === "zh-CN" ? original : translateTextValue(original),
        );
      }
    }

    function walk(node: Node): void {
      if (shouldSkipNode(node)) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        localizeTextNode(node as Text);
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        localizeElementAttributes(node as Element);
      }

      node.childNodes.forEach(walk);
    }

    let frame = 0;
    let timer = 0;
    const schedule = (delayMs = 0) => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      timer = window.setTimeout(() => {
        frame = requestAnimationFrame(() => walk(document.body));
      }, delayMs);
    };

    schedule();

    const observer = new MutationObserver(() => {
      schedule(ROUTE_MUTATION_TRANSLATION_DELAY_MS);
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [locale, phraseEntries]);

  return null;
}
