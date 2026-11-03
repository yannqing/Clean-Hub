import assert from "node:assert/strict";

import { saasMessagesByLocale } from "./messages/saas";
import { tenantMessagesByLocale } from "./messages/tenant";
import { enMessages } from "./messages/en";
import { frMessages } from "./messages/fr";
import { zhCNMessages } from "./messages/zh-CN";

/**
 * Guards the web-admin catalogues the way packages/i18n guards the POS ones.
 *
 * Three failure modes are pinned:
 *   - a key present in one locale and missing from another,
 *   - a {placeholder} that does not survive translation,
 *   - Chinese left in a translated bundle, which is how a missing translation
 *     usually arrives: the source pasted across.
 *
 * SaaS French must have its own translations; only explicitly reviewed French
 * cognates and protocol identifiers may match English.
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
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
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
  ["web-admin", { en: enMessages, fr: frMessages, "zh-CN": zhCNMessages }],
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

const tenantFlat = new Map(
  Object.entries(tenantMessagesByLocale).map(([locale, messages]) => [
    locale,
    flatten(messages),
  ]),
);
for (const [locale, messages] of [
  ["en", enMessages],
  ["fr", frMessages],
] as const) {
  for (const [key, value] of flatten(messages)) {
    if (han.test(value)) {
      console.error(`UNTRANSLATED web-admin.${locale}: ${key} = ${value}`);
      failures++;
    }
  }
}

assert.notEqual(
  saasMessagesByLocale.fr,
  saasMessagesByLocale.en,
  "SaaS French must not fall back to the English catalogue",
);
assert.equal(
  frMessages.saas,
  saasMessagesByLocale.fr,
  "Wire French into the active message bundle",
);

const sharedFrenchTerms = new Map([
  ["common.actions", "Actions"],
  ["common.priorityLabels.urgent", "Urgent"],
  ["tenants.list.metrics.total", "Total"],
  [
    "tenants.settings.featureFlagOptions.notificationsEnabled.label",
    "Notifications",
  ],
  ["tenants.form.featureFlags.notifications.label", "Notifications"],
  ["users.metrics.total", "Total"],
  ["systemLogs.service", "Service"],
  ["systemLogs.servicePlaceholder", "cleanhub-api"],
  ["systemLogs.columns.message", "Message"],
  ["backups.restoreColumns.actions", "Actions"],
  ["security.events.eventTypePlaceholder", "login_failed"],
  ["security.events.columns.description", "Description"],
  ["security.events.columns.ip", "IP"],
  ["feedbackTickets.columns.ticket", "Ticket"],
  ["feedbackTickets.columns.sla", "SLA"],
  ["feedbackTickets.fields.description", "Description"],
  ["feedbackTickets.sla.label", "SLA"],
  ["placeholders.profile.items.3", "Sessions"],
]);
const saasFrench = flatten(saasMessagesByLocale.fr);
for (const [key, source] of flatten(saasMessagesByLocale.en)) {
  if (saasFrench.get(key) === source && sharedFrenchTerms.get(key) !== source) {
    console.error(`ENGLISH FALLBACK saas.fr: ${key} = ${source}`);
    failures++;
  }
}
for (const area of ["saas", "tenant"] as const) {
  const destinations = (messages: typeof enMessages) =>
    messages.sidebar[area].map((section) =>
      section.items.map((item) => item.href),
    );
  assert.deepEqual(
    destinations(frMessages),
    destinations(enMessages),
    `French ${area} navigation must preserve destinations`,
  );
}

assert.equal(failures, 0, `${failures} web-admin i18n parity problems`);
console.log(
  `web-admin i18n parity passed (tenant ${tenantFlat.get("zh-CN")!.size} keys, saas ${flatten(saasMessagesByLocale["zh-CN"]).size} keys).`,
);
