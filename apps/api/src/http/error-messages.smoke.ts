import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { supportedLocales } from "@cleanhub/i18n/locales";
import ts from "typescript";

import {
  listLocalizedErrorMessages,
  localizeErrorMessage,
} from "./error-messages.js";

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(here, "..");
const repoRoot = join(apiSrc, "..", "..", "..");

/**
 * Every error message a cashier can reach must carry a translation.
 *
 * The catalogue is keyed by the English text, so editing a message at its
 * throw site silently orphans its translation -- the lookup misses and the
 * cashier is back to English. This walks POS, auth and tenant modules for
 * thrown messages and custom schema guidance the catalogue must cover.
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
    join(apiSrc, "modules", "mobile"),
    join(apiSrc, "modules", "tax"),
    join(apiSrc, "modules", "tenant"),
    join(apiSrc, "http"),
  ];
  const files = roots
    .flatMap((root) => walkTypeScript(root))
    .filter((file) => !file.includes(".test.") && !file.includes(".smoke."));

  const patterns = [
    /(?:invalid|validationError|conflict|appointmentConflict)\(\s*"((?:[^"\\]|\\.)*)"/g,
    /(?:\?|:)\s*"(Delivery task (?:is already terminal and cannot be overwritten|status transition is not allowed)\.)"/g,
    // new PosOrderError("CODE", "message"
    /new\s+\w*Error\(\s*\n?\s*"[A-Z_]+"\s*,\s*\n?\s*"((?:[^"\\]|\\.)*)"/g,
    // { code: "CODE", message: "message" }
    /code:\s*"[A-Z_]+"\s*,\s*\n?\s*message:\s*"((?:[^"\\]|\\.)*)"/g,
    // Tax readiness is a typed result returned from a helper, then raised by
    // the POS order service. Keep its operator guidance in the catalogue too.
    /missing\(\s*"POS_TAX_[A-Z_]+"\s*,\s*"((?:[^"\\]|\\.)*)"/g,
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
    // Follow conditional branches and interpolated business names, without
    // treating diagnostic strings or arbitrary stored content as UI copy.
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function collectMessage(node: ts.Node): void {
      let message: string | undefined;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        message = node.text;
      else if (ts.isTemplateExpression(node))
        message =
          node.head.text +
          node.templateSpans
            .map((span) => `{name}${span.literal.text}`)
            .join("");
      else if (ts.isConditionalExpression(node)) {
        collectMessage(node.whenTrue);
        collectMessage(node.whenFalse);
      }
      if (message)
        found.set(message, [
          ...(found.get(message) ?? []),
          relative(repoRoot, file),
        ]);
    }
    function visit(node: ts.Node): void {
      if (
        ts.isNewExpression(node) &&
        /Error$/.test(node.expression.getText(ast)) &&
        node.arguments?.[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        /^[A-Z_]+$/.test(node.arguments[0].text) &&
        node.arguments[1] &&
        file.includes(`${join("modules", "tenant")}`)
      )
        collectMessage(node.arguments[1]);
      if (
        file.endsWith("password-policy.helper.ts") &&
        ts.isReturnStatement(node) &&
        node.expression
      )
        collectMessage(node.expression);
      if (file.endsWith(".validation.ts")) {
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(ast) === "message"
        )
          collectMessage(node.initializer);
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          /^(regex|refine|min|max|length)$/.test(node.expression.name.text)
        ) {
          const last = node.arguments.at(-1);
          if (last && node.arguments.length > 1 && ts.isStringLiteral(last))
            collectMessage(last);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
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
  if (
    message === "Internal server error." ||
    message === "Request validation failed."
  ) {
    continue;
  }

  console.error(
    `ORPHANED: ${JSON.stringify(message)} is translated but never thrown`,
  );
  failures += 1;
}

// Every message must actually resolve in every locale, and no locale may be
// left holding the English.
for (const message of translated) {
  for (const locale of supportedLocales) {
    const localized = localizeErrorMessage(message, locale);

    if (!localized.trim()) {
      console.error(
        `EMPTY: ${locale} translation of ${JSON.stringify(message)}`,
      );
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

// Unknown French errors must remain readable without exposing untranslated text.
const unknown = "A message that is deliberately not in the catalogue.";
for (const locale of supportedLocales) {
  if (locale !== "fr" && localizeErrorMessage(unknown, locale) !== unknown) {
    console.error(
      `FALLBACK: ${locale} did not fall back to the original message`,
    );
    failures += 1;
  }
}
if (!localizeErrorMessage(unknown, "fr").startsWith("Une erreur"))
  failures += 1;
if (
  localizeErrorMessage('Category attribute "Taille" is required.', "fr") !==
  "L’attribut de catégorie « Taille » est obligatoire."
)
  failures += 1;

if (failures > 0) {
  console.error(
    `\nAPI error message check failed with ${failures} problem(s).`,
  );
  process.exit(1);
}

console.log(
  `API error messages passed (${translated.size} messages x ${supportedLocales.length} locales).`,
);
