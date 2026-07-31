import assert from "node:assert/strict";

import {
  POS_PIN_MAX_LENGTH,
  POS_PIN_MIN_LENGTH,
  validateLoginForm,
} from "./login-form.validator";

const messages = {
  pinRequired: "required",
  pinInvalid: "invalid",
};

assert.equal(POS_PIN_MIN_LENGTH, 4);
assert.equal(POS_PIN_MAX_LENGTH, 8);
assert.deepEqual(validateLoginForm({ pin: "" }, messages), {
  pin: "required",
});

for (const pin of ["1234", "12345", "123456", "1234567", "12345678"]) {
  assert.equal(
    validateLoginForm({ pin }, messages),
    null,
    `${pin.length}-digit PIN should be accepted`,
  );
}

for (const pin of ["123", "123456789", "12a4"]) {
  assert.deepEqual(
    validateLoginForm({ pin }, messages),
    { pin: "invalid" },
    `${pin} should be rejected`,
  );
}

console.log("POS login form PIN validation smoke ok");
