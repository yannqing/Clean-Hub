import assert from "node:assert/strict";

import type { EffectiveSecurityPolicy } from "../saas/security/security-policy.js";
import { assertPasswordMeetsPolicy } from "./password-policy.helper.js";
import { generateTemporaryPassword } from "./temporary-password.helper.js";

/**
 * The generator backs every operator-initiated reset -- SaaS users and tenant
 * users alike -- so a weak or policy-failing output would hand somebody an
 * unusable or guessable credential for an account they do not own.
 */

// The strictest shape the policy can take, so the generated password has to
// satisfy every requirement a tenant could turn on.
const strictPolicy: EffectiveSecurityPolicy = {
  passwordMinLength: 20,
  passwordRequiresNumber: true,
  passwordRequiresSymbol: true,
  loginMaxAttempts: 5,
  lockoutMinutes: 15,
  refreshTokenDays: 30,
};

const samples = Array.from({ length: 200 }, () => generateTemporaryPassword());

for (const password of samples) {
  assert.equal(password.length, 24, "temporary passwords are 24 characters");
  assert.doesNotThrow(
    () => assertPasswordMeetsPolicy(password, strictPolicy),
    `generated password must satisfy the strictest policy: ${password}`,
  );
  assert.match(password, /[a-z]/, "must contain a lowercase letter");
  assert.match(password, /[A-Z]/, "must contain an uppercase letter");
  assert.match(password, /[0-9]/, "must contain a digit");
  assert.match(password, /[!@#$%^&*\-_=+]/, "must contain a symbol");
  // The alphabets drop the glyphs that are easy to confuse when a temporary
  // password is read out over the phone to a locked-out store owner: l and o
  // in lowercase, I, L and O in uppercase, 0 and 1 in digits.
  assert.doesNotMatch(password, /[lo]/, "lowercase must drop l and o");
  assert.doesNotMatch(password, /[ILO]/, "uppercase must drop I, L and O");
  assert.doesNotMatch(password, /[01]/, "digits must drop 0 and 1");
}

assert.equal(
  new Set(samples).size,
  samples.length,
  "every generated password must be unique",
);

// The guaranteed-class characters must not always land in the same positions,
// or the first four characters would be predictable in shape.
const firstCharClasses = new Set(
  samples.map((password) => {
    const first = password[0]!;
    if (/[a-z]/.test(first)) return "lower";
    if (/[A-Z]/.test(first)) return "upper";
    if (/[0-9]/.test(first)) return "digit";
    return "symbol";
  }),
);

assert.ok(
  firstCharClasses.size > 1,
  "the shuffle must not pin a character class to a fixed position",
);

console.log("temporary password smoke passed.");
