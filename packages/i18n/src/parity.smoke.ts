import { messages } from "@cleanhub/i18n";

function flatten(obj: unknown, prefix = "", out: Map<string, string> = new Map()) {
  if (typeof obj === "string") { out.set(prefix, obj); return out; }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

const locales = Object.keys(messages) as (keyof typeof messages)[];
const flat = new Map(locales.map((l) => [l, flatten(messages[l])] as const));
const base = flat.get("zh-CN")!;
let bad = 0;

for (const loc of locales) {
  const m = flat.get(loc)!;
  for (const k of base.keys()) if (!m.has(k)) { console.error(`MISSING ${loc}: ${k}`); bad++; }
  for (const k of m.keys()) if (!base.has(k)) { console.error(`EXTRA   ${loc}: ${k}`); bad++; }
}

// every {placeholder} in zh-CN must appear in the other locales
const ph = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
for (const [k, zhv] of base) {
  for (const loc of locales) {
    if (loc === "zh-CN") continue;
    const v = flat.get(loc)!.get(k);
    if (v === undefined) continue;
    const a = ph(zhv), b = ph(v);
    for (const p of a) if (!b.has(p)) { console.error(`PLACEHOLDER ${loc}.${k}: missing {${p}}`); bad++; }
    for (const p of b) if (!a.has(p)) { console.error(`PLACEHOLDER ${loc}.${k}: unexpected {${p}}`); bad++; }
  }
}

// No Chinese may survive in the English or French bundle. A missing
// translation usually arrives as the Chinese source copied across, which the
// key and placeholder checks above cannot see.
const han = /[\u4e00-\u9fff]/;
for (const loc of locales) {
  if (loc === "zh-CN") continue;
  for (const [k, v] of flat.get(loc)!) {
    if (han.test(v)) { console.error(`UNTRANSLATED ${loc}: ${k} = ${v}`); bad++; }
  }
}

console.log(bad === 0 ? `i18n parity passed (${base.size} keys x ${locales.length} locales)` : `i18n parity FAILED: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
