import assert from "node:assert/strict";

import { AuthError } from "./auth.errors.js";
import {
  assertEnrolledTerminalCredential,
  buildPosPinLockKeys,
  createTerminalCredentialCookieHeader,
  generateTerminalCredential,
  hashTerminalCredential,
  terminalCredentialMatches,
} from "./pos-terminal-credential.js";
import { TokenService } from "./token.service.js";

const credential = generateTerminalCredential();
const digest = hashTerminalCredential(credential);

assert.notEqual(credential, digest, "raw terminal credentials are not stored");
assert.equal(
  terminalCredentialMatches(credential, digest),
  true,
  "the issued credential matches its digest",
);
assert.equal(
  terminalCredentialMatches(`${credential}-wrong`, digest),
  false,
  "a modified credential is rejected",
);

const activeTerminal = {
  id: "01K00000000000000000000001",
  branchId: "01K00000000000000000000002",
  status: "active" as const,
  credentialDigest: digest,
};
assert.doesNotThrow(() =>
  assertEnrolledTerminalCredential(activeTerminal, credential),
);

for (const [terminal, presented, code] of [
  [null, credential, "POS_TERMINAL_ENROLLMENT_REQUIRED"],
  [{ ...activeTerminal, status: "inactive" as const }, credential, "POS_TERMINAL_DISABLED"],
  [activeTerminal, "wrong", "POS_TERMINAL_CREDENTIAL_INVALID"],
] as const) {
  assert.throws(
    () => assertEnrolledTerminalCredential(terminal, presented),
    (error) => error instanceof AuthError && error.code === code,
  );
}

const lockKeys = buildPosPinLockKeys({
  tenantId: "01K00000000000000000000003",
  terminalId: activeTerminal.id,
  ipAddress: "203.0.113.10",
});
assert.deepEqual(lockKeys, [
  `pos-pin-terminal:01K00000000000000000000003:${activeTerminal.id}`,
  "pos-pin-network:01K00000000000000000000003:203.0.113.10",
]);
assert.equal(
  lockKeys.some((key) => key.includes("local-storage-device")),
  false,
  "lockout keys do not trust a browser-generated device id",
);

const cookie = createTerminalCredentialCookieHeader(credential, {
  secure: true,
});
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /Secure/);
assert.match(cookie, /SameSite=Lax/);
assert.match(cookie, /Path=\//);

const tokenService = new TokenService({
  secret: "pos-terminal-security-smoke-secret-value",
});
const tokens = await tokenService.issueTokenPair({
  userId: "01K00000000000000000000004",
  tenantId: "01K00000000000000000000003",
  role: "cashier",
  roles: ["cashier"],
  permissions: [],
  branchIds: [activeTerminal.branchId],
  terminalId: activeTerminal.id,
  terminalBranchId: activeTerminal.branchId,
  terminalDeviceId: "registered-device",
});
const claims = await tokenService.verifyAccessToken(tokens.accessToken);
assert.equal(claims.terminalId, activeTerminal.id);
assert.equal(claims.terminalBranchId, activeTerminal.branchId);
assert.deepEqual(claims.branchIds, [activeTerminal.branchId]);

console.log("POS terminal security smoke passed.");
