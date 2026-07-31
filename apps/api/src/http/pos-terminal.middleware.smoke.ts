import assert from "node:assert/strict";

import { AuthError } from "../modules/auth/auth.errors.js";
import {
  assertPosTerminalManagementSession,
  isPosTerminalSetupRequest,
} from "./pos-terminal.middleware.js";

const managementRoutes = [
  ["POST", "/pos/auth/devices"],
  ["GET", "/pos/auth/devices/device-1"],
  ["PATCH", "/pos/auth/devices/device-1"],
  ["POST", "/pos/auth/devices/device-1/credential-rotation"],
  ["POST", "/pos/auth/devices/device-1/revocation"],
  ["GET", "/pos/auth/terminals/device-1"],
  ["PATCH", "/pos/auth/terminals/device-1/lock"],
] as const;

for (const [method, path] of managementRoutes) {
  assert.equal(
    isPosTerminalSetupRequest(method, path),
    true,
    `${method} ${path} must be classified as terminal management`,
  );
  assert.throws(
    () =>
      assertPosTerminalManagementSession({
        terminalId: "terminal-bound-owner-or-manager",
      }),
    (error: unknown) =>
      error instanceof AuthError && error.code === "FORBIDDEN",
    `${method} ${path} must reject a terminal-bound PIN session`,
  );
}

assert.doesNotThrow(
  () => assertPosTerminalManagementSession({}),
  "a password-authenticated Owner/Manager proceeds to service role and branch checks",
);

assert.equal(
  isPosTerminalSetupRequest("POST", "/pos/orders"),
  false,
  "ordinary POS business routes still require a terminal-bound session",
);

console.log("POS API surface boundary smoke passed.");
