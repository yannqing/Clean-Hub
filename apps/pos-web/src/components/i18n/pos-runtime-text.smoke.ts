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
  "该页面可能已经移动、被删除，或当前终端没有对应的访问入口。",
  "请输入有效金额，并填写至少 3 个字符的原因。",
  "该客户档案可能已被删除，或不属于当前门店可访问的范围。",
  "现金入柜",
  "客户未找到",
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

// Text with no Han characters is returned as-is regardless of locale.
assert.equal(translatePosText("OD-Q69G5FAW", "fr"), "OD-Q69G5FAW");
assert.equal(translatePosText("", "en"), "");

console.log("POS runtime text smoke passed.");
