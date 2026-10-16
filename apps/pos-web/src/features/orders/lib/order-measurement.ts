import type { PosOrderItem } from "@cleanhub/api-client";
import { normalizeLocale, type SupportedLocale } from "@cleanhub/i18n";

type UnitCopy = {
  "zh-CN": string;
  en: readonly [singular: string, plural: string];
  fr: readonly [singular: string, plural: string];
};

const UNIT_ALIASES: Record<string, UnitCopy> = {
  piece: { "zh-CN": "件", en: ["piece", "pieces"], fr: ["pièce", "pièces"] },
  item: { "zh-CN": "件", en: ["item", "items"], fr: ["article", "articles"] },
  unit: { "zh-CN": "件", en: ["unit", "units"], fr: ["unité", "unités"] },
  pc: { "zh-CN": "件", en: ["pc", "pcs"], fr: ["pièce", "pièces"] },
  pcs: { "zh-CN": "件", en: ["pc", "pcs"], fr: ["pièce", "pièces"] },
  box: { "zh-CN": "盒", en: ["box", "boxes"], fr: ["boîte", "boîtes"] },
  bag: { "zh-CN": "袋", en: ["bag", "bags"], fr: ["sac", "sacs"] },
  bottle: {
    "zh-CN": "瓶",
    en: ["bottle", "bottles"],
    fr: ["bouteille", "bouteilles"],
  },
  pack: { "zh-CN": "包", en: ["pack", "packs"], fr: ["paquet", "paquets"] },
  pair: { "zh-CN": "对", en: ["pair", "pairs"], fr: ["paire", "paires"] },
  set: { "zh-CN": "套", en: ["set", "sets"], fr: ["ensemble", "ensembles"] },
  roll: { "zh-CN": "卷", en: ["roll", "rolls"], fr: ["rouleau", "rouleaux"] },
};

const UNIT_ALIAS_KEYS: Record<string, keyof typeof UNIT_ALIASES> = {
  pieces: "piece",
  items: "item",
  units: "unit",
  boxes: "box",
  bags: "bag",
  bottles: "bottle",
  packs: "pack",
  pairs: "pair",
  sets: "set",
  rolls: "roll",
  件: "piece",
  盒: "box",
  袋: "bag",
  瓶: "bottle",
  包: "pack",
  对: "pair",
  套: "set",
  卷: "roll",
};

export function formatOrderItemMeasurement(
  item: Pick<
    PosOrderItem,
    "bagCount" | "pricingUnit" | "quantity" | "unitOfMeasure" | "weight"
  >,
  locale: string,
): string {
  const resolvedLocale = normalizeLocale(locale) ?? "zh-CN";

  if (item.pricingUnit === "per_kg") {
    const weight = formatMeasurementNumber(
      item.weight ?? item.quantity,
      resolvedLocale,
      3,
    );
    const bags = item.bagCount
      ? ` · ${formatMeasurementNumber(String(item.bagCount), resolvedLocale, 0)} ${formatUnitOfMeasure("bag", resolvedLocale, item.bagCount)}`
      : "";
    return `${weight} kg${bags}`;
  }

  const quantity = Number(item.quantity);
  return `${formatMeasurementNumber(item.quantity, resolvedLocale, 3)} ${formatUnitOfMeasure(
    item.unitOfMeasure ?? "piece",
    resolvedLocale,
    quantity,
  )}`;
}

export function formatMeasurementNumber(
  value: string,
  locale: SupportedLocale,
  maximumFractionDigits: number,
): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  }).format(numericValue);
}

export function formatUnitOfMeasure(
  value: string,
  locale: SupportedLocale,
  quantity: number,
): string {
  const normalized = value.trim().toLowerCase();
  const canonical = UNIT_ALIASES[normalized]
    ? normalized
    : UNIT_ALIAS_KEYS[normalized];
  const copy = canonical ? UNIT_ALIASES[canonical] : undefined;

  if (!copy) {
    return value;
  }
  if (locale === "zh-CN") {
    return copy[locale];
  }

  return copy[locale][quantity === 1 ? 0 : 1];
}
