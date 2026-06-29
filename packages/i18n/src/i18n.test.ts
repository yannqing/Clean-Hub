import assert from "node:assert/strict";

import {
  defaultLocale,
  listMessageKeys,
  messages,
  normalizeLocale,
  resolveLocale,
  supportedLocales,
  translate,
  type SupportedLocale,
  type TranslationKey,
} from "./index";

assert.equal(defaultLocale, "fr");
assert.equal(normalizeLocale("zh"), "zh-CN");
assert.equal(normalizeLocale("zh_CN"), "zh-CN");
assert.equal(normalizeLocale("fr-FR"), "fr");
assert.equal(normalizeLocale("en-US"), "en");
assert.equal(normalizeLocale("es"), null);

assert.equal(
  resolveLocale({
    userPreference: null,
    tenantDefault: "en",
    deviceLocale: "zh",
  }),
  "en",
);
assert.equal(
  resolveLocale({
    userPreference: "zh",
    tenantDefault: "en",
    deviceLocale: "fr",
  }),
  "zh-CN",
);

assert.equal(
  translate("auth.tenant.active", { tenantCode: "CLEAN-001" }, { locale: "en" }),
  "Active context: CLEAN-001",
);

const missingKey = "common.__missing" as TranslationKey;
assert.equal(translate(missingKey, undefined, { locale: "en" }), missingKey);

const baseKeys = listMessageKeys(messages[defaultLocale]);
for (const locale of supportedLocales) {
  const keys = new Set(listMessageKeys(messages[locale as SupportedLocale]));
  const missing = baseKeys.filter((key) => !keys.has(key));
  assert.deepEqual(missing, [], `${locale} is missing translation keys`);
}

console.log("i18n runtime tests passed.");
