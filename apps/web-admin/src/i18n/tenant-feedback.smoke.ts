import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { enMessages } from "./messages/en";
import { frMessages } from "./messages/fr";
import { getWebAdminFeedbackTranslator } from "./feedback";

const feedback = getWebAdminFeedbackTranslator("fr", frMessages, "tenant");
assert.equal(
  feedback("card cannot be enabled on this terminal."),
  "Ces moyens de paiement ne peuvent pas être activés sur ce terminal : Carte.",
);
assert.equal(
  feedback("Failed to reset PIN."),
  "Impossible de réinitialiser le PIN.",
);
assert.equal(
  feedback("Branch has been modified. Refresh and try again."),
  "La succursale a été modifiée. Actualisez puis réessayez.",
);
assert.equal(
  feedback('Category attribute "Blue Cotton" is required.'),
  "L’attribut de catégorie « Blue Cotton » est obligatoire.",
);
assert.equal(
  feedback("Le PIN actuel est incorrect."),
  "Le PIN actuel est incorrect.",
);
assert.equal(
  feedback("Unknown upstream failure Request ID: req-fr-1"),
  `${frMessages.tenant.common.somethingWentWrong} Référence : req-fr-1`,
);
assert.equal(
  feedback,
  getWebAdminFeedbackTranslator("fr", frMessages, "tenant"),
);
assert.equal(
  getWebAdminFeedbackTranslator("en", enMessages, "tenant")("Original detail"),
  "Original detail",
);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(directory, entry.name)]
        : [],
  );
}
const failures = new Set<string>();
for (const file of walk("src/features/tenant").filter(
  (file) =>
    /\/(actions|validators)\//.test(file) && !/\.(?:smoke|test)\./.test(file),
)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node: ts.Node) {
    if (
      ts.isStringLiteral(node) &&
      /[A-Za-z]{2} [A-Za-z]{2}/.test(node.text) &&
      !["use server", "use client"].includes(node.text)
    ) {
      const translated = feedback(node.text);
      if (
        translated === node.text ||
        translated === frMessages.tenant.common.somethingWentWrong
      )
        failures.add(`${file}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
assert.deepEqual(
  [...failures],
  [],
  "Tenant validation/action feedback must have specific French guidance",
);
console.log(
  "Tenant French feedback passed (action/validator coverage, API templates, request references and locale switching).",
);
