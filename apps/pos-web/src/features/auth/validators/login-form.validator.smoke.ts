import assert from "node:assert/strict";

import {
  POS_PIN_LENGTH,
  validateLoginForm,
} from "./login-form.validator";

const messages = {
  pinRequired: "required",
  pinInvalid: "invalid",
};

assert.equal(POS_PIN_LENGTH, 6);
assert.deepEqual(validateLoginForm({ pin: "" }, messages), {
  pin: "required",
});

assert.equal(validateLoginForm({ pin: "123456" }, messages), null);

for (const pin of ["123", "12345", "1234567", "123456789", "12a456"]) {
  assert.deepEqual(
    validateLoginForm({ pin }, messages),
    { pin: "invalid" },
    `${pin} should be rejected`,
  );
}

console.log("POS login form PIN validation smoke ok");
