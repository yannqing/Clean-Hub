import assert from "node:assert/strict";

import { enMessages } from "./messages/en";
import { frMessages } from "./messages/fr";
import { zhCNMessages } from "./messages/zh-CN";
import { getSaasFeedbackTranslator } from "./saas-feedback";

const translate = getSaasFeedbackTranslator("fr", frMessages);
assert.equal(
  translate("Email is required."),
  "L’adresse e-mail est obligatoire.",
);
assert.equal(translate("Country is required."), "Le pays est obligatoire.");
assert.match(
  translate("Password must be at least 14 characters."),
  /^Le mot de passe .*14\s+caractères\.$/,
);
assert.equal(
  translate("Failed to fetch Request ID: req-123"),
  "Impossible de joindre le serveur. Vérifiez votre connexion. Référence : req-123",
);
assert.equal(
  translate(
    enMessages.saas.users.roleRefreshError.replace(
      "{error}",
      "Failed to fetch",
    ),
  ),
  frMessages.saas.users.roleRefreshError.replace(
    "{error}",
    "Impossible de joindre le serveur. Vérifiez votre connexion.",
  ),
);
assert.equal(
  translate(
    enMessages.saas.users.roleRefreshError.replace(
      "{error}",
      "An undocumented server failure",
    ),
  ),
  frMessages.saas.users.roleRefreshError.replace(
    "{error}",
    frMessages.saas.common.somethingWentWrong,
  ),
);
const conflict = enMessages.saas.users.resetPin.conflict.replaceAll(
  "{value}",
  "666666",
);
const frenchConflict = frMessages.saas.users.resetPin.conflict.replaceAll(
  "{value}",
  "666666",
);
assert.equal(
  translate(conflict),
  frenchConflict,
  "Preserve credential values in translated feedback",
);
assert.equal(
  translate(frenchConflict),
  frenchConflict,
  "Already-localized feedback must stay readable",
);
assert.equal(
  translate(frMessages.saas.tenants.form.countrySetup.missing),
  frMessages.saas.tenants.form.countrySetup.missing,
);
assert.equal(
  translate("An undocumented server failure"),
  frMessages.saas.common.somethingWentWrong,
  "Unknown feedback must not leak English through a catch-all placeholder",
);
assert.equal(translate(null), "");
assert.equal(translate(undefined), "");
assert.equal(
  translate,
  getSaasFeedbackTranslator("fr", frMessages),
  "Effects need stable translators",
);
for (const [locale, messages] of [
  ["en", enMessages],
  ["zh-CN", zhCNMessages],
] as const) {
  const unchanged = getSaasFeedbackTranslator(locale, messages);
  assert.equal(unchanged("Existing feedback"), "Existing feedback");
  assert.equal(
    unchanged,
    getSaasFeedbackTranslator(locale, messages),
    "Changing translator identity must not restart request effects",
  );
}
console.log(
  "SaaS French feedback checks passed (validation, request references, templates, fallback and stable effects).",
);
