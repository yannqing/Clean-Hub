import assert from "node:assert/strict";

import { translatePosText } from "./pos-runtime-text";

const HAN_RE = /[㐀-鿿]/;

// Chinese is the source language: it is returned untouched, never routed
// through the dictionary.
assert.equal(translatePosText("现金入柜", "zh-CN"), "现金入柜");

// A string the dictionary carries whole translates exactly.
assert.equal(translatePosText("保存", "en"), "Save");
assert.equal(translatePosText("保存", "fr"), "Enregistrer");

// Phrase substitution still wins when it resolves the whole string: the
// dictionary carries each piece, so nothing Han is left.
for (const locale of ["en", "fr"] as const) {
  const composed = translatePosText("共", locale);
  assert.equal(
    HAN_RE.test(composed),
    false,
    `a fully resolvable phrase must not keep Han characters in ${locale}`,
  );
}

/**
 * The regression this module exists to prevent.
 *
 * These sentences are not in the dictionary, but their fragments are, so the
 * substitution loop used to splice them into mixed Chinese/Latin garbage --
 * "只有store manager或manage员...", "该page面可能已经移动". A partially
 * translated string must fall back to the source text instead.
 */
const partiallyTranslatable = [
  "只有店长或管理员可以登记非销售现金进出。",
  "请输入有效金额，并填写至少 3 个字符的原因。",
  "现金入柜",
  // Sentences the dictionary does not carry whole. Deliberately not real UI
  // copy: a screen string gets translated sooner or later, and then it stops
  // testing the fallback -- which is exactly what happened to the three
  // entries this list used to hold.
  "请把这件衣服单独存放并通知店长处理。",
  "客户临时取消了本次预约并要求全额退款。",
  "本月的营业额统计需要重新核对一遍。",
];

for (const source of partiallyTranslatable) {
  for (const locale of ["en", "fr"] as const) {
    const result = translatePosText(source, locale);
    assert.equal(
      result,
      source,
      `a partially translatable string must fall back to its source in ${locale}`,
    );
  }
}

// Nothing the function returns may ever mix scripts inside one word: every
// result is either fully translated or the untouched source.
const samples = [...partiallyTranslatable, "保存", "取消", "删除", "共", "条"];
for (const source of samples) {
  for (const locale of ["en", "fr"] as const) {
    const result = translatePosText(source, locale);
    assert.equal(
      result === source || !HAN_RE.test(result),
      true,
      `${locale} result for "${source}" must be all-or-nothing, got "${result}"`,
    );
  }
}

/**
 * Curated counter vocabulary.
 *
 * The generated dictionary renders many of these as lowercase machine
 * glosses -- 普通 as "ordinary", 设置 as "set up" -- which is worse than an
 * untranslated string because nothing flags it as wrong. The overrides map
 * fixes them, and these assertions keep them fixed: deleting an override, or
 * letting the generated dictionary shadow one, fails here rather than
 * silently reverting a cashier's priority column to "ordinary / urgent".
 */
const curated: ReadonlyArray<readonly [string, string, string]> = [
  ["普通", "Normal", "Normale"],
  ["加急", "Rush", "Urgente"],
  ["最紧急", "Critical", "Critique"],
  ["衣物", "Garment", "Vêtement"],
  ["质检中", "Quality check", "Contrôle qualité"],
  ["异常", "Issue", "Problème"],
  ["设置", "Settings", "Paramètres"],
  ["工作台", "Workspace", "Espace de travail"],
  ["材质", "Material", "Matière"],
  ["单价", "Unit price", "Prix unitaire"],
];

for (const [source, en, fr] of curated) {
  assert.equal(
    translatePosText(source, "en"),
    en,
    `"${source}" must use the curated English wording`,
  );
  assert.equal(
    translatePosText(source, "fr"),
    fr,
    `"${source}" must use the curated French wording`,
  );
}

// A counter-facing label must never read as a lowercase gloss.
for (const [source] of curated) {
  const english = translatePosText(source, "en");
  assert.equal(
    /^[A-Z]/.test(english),
    true,
    `"${source}" renders as the gloss "${english}" rather than a real label`,
  );
}

// Text with no Han characters is returned as-is regardless of locale.
assert.equal(translatePosText("OD-Q69G5FAW", "fr"), "OD-Q69G5FAW");
assert.equal(translatePosText("", "en"), "");

console.log("POS runtime text smoke passed.");
