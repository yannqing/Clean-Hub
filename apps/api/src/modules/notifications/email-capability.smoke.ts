import assert from "node:assert/strict";

import { isEmailConfigured } from "./email-config.js";

/**
 * Email is gated by two independent conditions and needs BOTH:
 *
 *   platform has SMTP  AND  tenant is entitled to email
 *
 * SMTP is a single platform-wide configuration, so the first is a ceiling on
 * every tenant. Dropping either half would let the till offer an emailed
 * receipt the server then refuses, which the cashier only discovers after the
 * customer has walked away.
 */

// --- the platform half -----------------------------------------------------

assert.equal(isEmailConfigured({}), false, "no host means no email");
assert.equal(
  isEmailConfigured({ EMAIL_SMTP_HOST: "smtp.example.com" }),
  true,
);
assert.equal(
  isEmailConfigured({ SMTP_HOST: "smtp.example.com" }),
  true,
  "the legacy SMTP_HOST name is still honoured, as loadEmailConfig does",
);
assert.equal(
  isEmailConfigured({ EMAIL_SMTP_HOST: "   " }),
  false,
  "a blank host is not a configuration",
);
assert.equal(isEmailConfigured({ EMAIL_SMTP_HOST: "" }), false);

// --- both halves together --------------------------------------------------

/** The rule as the POS settings service and the receipt guard apply it. */
function emailReceiptEnabled(
  env: NodeJS.ProcessEnv,
  tenantEmailEnabled: boolean,
): boolean {
  return isEmailConfigured(env) && tenantEmailEnabled;
}

const withSmtp = { EMAIL_SMTP_HOST: "smtp.example.com" };

assert.equal(
  emailReceiptEnabled(withSmtp, true),
  true,
  "SMTP present and tenant entitled",
);
assert.equal(
  emailReceiptEnabled(withSmtp, false),
  false,
  "a tenant that is not entitled gets no email even with SMTP",
);
assert.equal(
  emailReceiptEnabled({}, true),
  false,
  "an entitled tenant still gets no email while the platform has no SMTP",
);
assert.equal(emailReceiptEnabled({}, false), false);

console.log("email capability smoke passed.");
