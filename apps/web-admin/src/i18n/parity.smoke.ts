import assert from "node:assert/strict";

import { saasMessagesByLocale } from "./messages/saas";
import { tenantMessagesByLocale } from "./messages/tenant";

/**
 * Guards the web-admin catalogues the way packages/i18n guards the POS ones.
 *
 * Three failure modes are pinned:
 *   - a key present in one locale and missing from another,
 *   - a {placeholder} that does not survive translation,
 *   - Chinese left in a translated bundle, which is how a missing translation
 *     usually arrives: the source pasted across.
 *
 * The saas bundle deliberately maps `fr` to the English messages -- there is no
 * French SaaS catalogue yet -- so French and English are expected to be equal
 * there. That is asserted rather than ignored, so the day a real French bundle
 * lands this test says so instead of silently passing.
 */
function flatten(
  value: unknown,
  prefix = "",
  out: Map<string, string> = new Map(),
): Map<string, string> {
  if (typeof value === "string") {
    out.set(prefix, value);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

const han = /[一-鿿]/;
const placeholders = (value: string) =>
  new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));

let failures = 0;

for (const [name, byLocale] of [
  ["tenant", tenantMessagesByLocale],
  ["saas", saasMessagesByLocale],
] as const) {
  const flat = new Map(
    Object.entries(byLocale).map(([locale, messages]) => [
      locale,
      flatten(messages),
    ]),
  );
  const base = flat.get("zh-CN");
  assert.ok(base, `${name}: no zh-CN bundle`);

  for (const [locale, messages] of flat) {
    for (const key of base.keys()) {
      if (!messages.has(key)) {
        console.error(`MISSING ${name}.${locale}: ${key}`);
        failures++;
      }
    }
    for (const key of messages.keys()) {
      if (!base.has(key)) {
        console.error(`EXTRA   ${name}.${locale}: ${key}`);
        failures++;
      }
    }
  }

  for (const [key, source] of base) {
    for (const [locale, messages] of flat) {
      if (locale === "zh-CN") continue;
      const value = messages.get(key);
      if (value === undefined) continue;

      const wanted = placeholders(source);
      const got = placeholders(value);
      for (const name_ of wanted) {
        if (!got.has(name_)) {
          console.error(
            `PLACEHOLDER ${name}.${locale}.${key}: missing {${name_}}`,
          );
          failures++;
        }
      }
      for (const name_ of got) {
        if (!wanted.has(name_)) {
          console.error(
            `PLACEHOLDER ${name}.${locale}.${key}: unexpected {${name_}}`,
          );
          failures++;
        }
      }
    }
  }
}

// The tenant bundle is fully translated, so no Chinese may survive in en/fr.
// The saas bundle has no French copy yet (fr falls back to English), so only
// its English side is checked.
const tenantFlat = new Map(
  Object.entries(tenantMessagesByLocale).map(([locale, messages]) => [
    locale,
    flatten(messages),
  ]),
);
for (const locale of ["en", "fr"] as const) {
  for (const [key, value] of tenantFlat.get(locale)!) {
    if (han.test(value)) {
      console.error(`UNTRANSLATED tenant.${locale}: ${key} = ${value}`);
      failures++;
    }
  }
}
for (const [key, value] of flatten(saasMessagesByLocale.en)) {
  if (han.test(value)) {
    console.error(`UNTRANSLATED saas.en: ${key} = ${value}`);
    failures++;
  }
}

// The saas French fallback is deliberate. Pinning it means the day a real
// French saas bundle is added, this line fails and asks to be updated rather
// than letting a half-wired bundle ship unnoticed.
assert.equal(
  saasMessagesByLocale.fr,
  saasMessagesByLocale.en,
  "saas `fr` is expected to fall back to the English bundle; if a French saas catalogue now exists, translate this assertion into a real parity check",
);

assert.equal(failures, 0, `${failures} web-admin i18n parity problems`);
console.log(
  `web-admin i18n parity passed (tenant ${tenantFlat.get("zh-CN")!.size} keys, saas ${flatten(saasMessagesByLocale["zh-CN"]).size} keys).`,
);
