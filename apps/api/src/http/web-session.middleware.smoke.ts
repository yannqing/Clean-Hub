import assert from "node:assert/strict";

import { AuthError } from "../modules/auth/auth.errors.js";
import { assertNonTerminalWebSession } from "./web-session.middleware.js";

assert.doesNotThrow(
  () => assertNonTerminalWebSession({}),
  "an ordinary password-authenticated web session remains allowed",
);

for (const role of ["owner", "manager"] as const) {
  assert.throws(
    () =>
      assertNonTerminalWebSession({
        terminalId: `terminal-for-${role}`,
      }),
    (error: unknown) =>
      error instanceof AuthError &&
      error.code === "FORBIDDEN" &&
      error.message.includes("back-office"),
    `a terminal-bound ${role} session must be rejected`,
  );
}

console.log("Web session boundary smoke passed.");
