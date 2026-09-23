import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { supportedLocales } from "@cleanhub/i18n";

import { listLocalizedErrorMessages, localizeErrorMessage } from "./error-messages.js";

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(here, "..");
const repoRoot = join(apiSrc, "..", "..", "..");

/**
 * Every error message a cashier can reach must carry a translation.
 *
 * The catalogue is keyed by the English text, so editing a message at its
 * throw site silently orphans its translation -- the lookup misses and the
 * cashier is back to English. This walks the POS and auth modules for thrown
 * messages and reports any the catalogue does not cover.
 */
function walkTypeScript(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScript(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function collectThrownMessages(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  // http/ as well as the modules: the auth middleware raises the error an
  // unauthenticated POS request meets first, and scoping to modules/ alone is
  // what let "Access token is required." ship untranslated.
  const roots = [
    join(apiSrc, "modules", "pos"),
    join(apiSrc, "modules", "auth"),
    join(apiSrc, "http"),
  ];
  const files = roots
    .flatMap((root) => walkTypeScript(root))
    .filter((file) => !file.includes(".test.") && !file.includes(".smoke."));

  const patterns = [
    // new PosOrderError("CODE", "message"
    /new\s+\w*Error\(\s*\n?\s*"[A-Z_]+"\s*,\s*\n?\s*"((?:[^"\\]|\\.)*)"/g,
    // { code: "CODE", message: "message" }
    /code:\s*"[A-Z_]+"\s*,\s*\n?\s*message:\s*"((?:[^"\\]|\\.)*)"/g,
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const message = match[1];
        if (!message) continue;
        const where = found.get(message) ?? [];
        where.push(relative(repoRoot, file));
        found.set(message, where);
      }
    }
  }

  return found;
}

let failures = 0;

const thrown = collectThrownMessages();
const translated = new Set(listLocalizedErrorMessages());

// Operator-facing startup failures never reach a cashier; they are read from
// logs by whoever is deploying, and translating them would only obscure them.
const OPERATOR_ONLY = /^AUTH_TOKEN_SECRET /;

for (const [message, files] of thrown) {
  if (OPERATOR_ONLY.test(message)) continue;
  if (translated.has(message)) continue;

  console.error(
    `UNTRANSLATED: ${JSON.stringify(message)}\n  thrown in ${files[0]}`,
  );
  failures += 1;
}

// A translation whose English key no longer exists is dead weight and usually
// means a message was reworded without its translation following.
for (const message of translated) {
  if (thrown.has(message)) continue;
  // The central handler raises these two itself rather than from a module.
  if (message === "Internal server error." || message === "Request validation failed.") {
    continue;
  }

  console.error(`ORPHANED: ${JSON.stringify(message)} is translated but never thrown`);
  failures += 1;
}

// Every message must actually resolve in every locale, and no locale may be
// left holding the English.
for (const message of translated) {
  for (const locale of supportedLocales) {
    const localized = localizeErrorMessage(message, locale);

    if (!localized.trim()) {
      console.error(`EMPTY: ${locale} translation of ${JSON.stringify(message)}`);
      failures += 1;
      continue;
    }

    if (locale !== "en" && localized === message) {
      console.error(
        `UNTRANSLATED ${locale}: ${JSON.stringify(message)} is still the English`,
      );
      failures += 1;
    }
  }
}

// An unknown message must fall back to itself rather than throwing or
// returning undefined: a missing translation during a sale must not become a
// blank error.
const unknown = "A message that is deliberately not in the catalogue.";
for (const locale of supportedLocales) {
  if (localizeErrorMessage(unknown, locale) !== unknown) {
    console.error(`FALLBACK: ${locale} did not fall back to the original message`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\nAPI error message check failed with ${failures} problem(s).`);
  process.exit(1);
}

console.log(
  `API error messages passed (${translated.size} messages x ${supportedLocales.length} locales).`,
);
