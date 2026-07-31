import assert from "node:assert/strict";

import type { Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import type { AuthContext } from "../../auth/auth.types.js";
import { createPosTerminalSettingsRoutes } from "./terminal-settings.routes.js";
import {
  getPosTerminalSettings,
  heartbeatPosTerminal,
  updatePosTerminalSettings,
} from "./terminal-settings.service.js";
import {
  terminalHeartbeatBodySchema,
  updateTerminalSettingsBodySchema,
} from "./terminal-settings.validation.js";

const ordinaryOwnerContext: AuthContext = {
  userId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  displayName: "Owner without terminal binding",
  tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  branchIds: [],
  role: "owner",
  roles: ["owner"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const unreachableDb = {} as Database;

async function expectTerminalEnrollmentRequired(
  promise: Promise<unknown>,
): Promise<void> {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof AuthError &&
      error.code === "POS_TERMINAL_ENROLLMENT_REQUIRED",
  );
}

await expectTerminalEnrollmentRequired(
  getPosTerminalSettings(ordinaryOwnerContext, unreachableDb),
);
await expectTerminalEnrollmentRequired(
  updatePosTerminalSettings(
    ordinaryOwnerContext,
    { label: "Must not reach the repository" },
    undefined,
    unreachableDb,
  ),
);
await expectTerminalEnrollmentRequired(
  heartbeatPosTerminal(ordinaryOwnerContext, {}, unreachableDb),
);

for (const identityField of ["branchId", "deviceId", "terminalId"] as const) {
  assert.throws(() =>
    updateTerminalSettingsBodySchema.parse({
      label: "Front counter",
      [identityField]: "untrusted-identity",
    }),
  );
  assert.throws(() =>
    terminalHeartbeatBodySchema.parse({
      [identityField]: "untrusted-identity",
    }),
  );
}

const routes = createPosTerminalSettingsRoutes();
const legacyCreateResponse = await routes.request("/", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    deviceId: "untrusted-device",
  }),
});
assert.equal(
  legacyCreateResponse.status,
  404,
  "terminal enrollment must use the dedicated POS auth bind route",
);

console.log("POS terminal settings security smoke passed.");
