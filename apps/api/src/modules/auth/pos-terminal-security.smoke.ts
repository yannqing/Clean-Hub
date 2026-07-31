import assert from "node:assert/strict";

import { AuthError } from "./auth.errors.js";
import { resolveAuthCookieSecure } from "./cookie.service.js";
import { resolvePosBootstrapState } from "./pos-bootstrap-state.js";
import {
  assertEnrolledTerminalCredential,
  buildPosPinLockKeys,
  createClearTerminalCredentialCookieHeader,
  createTerminalCredentialCookieHeader,
  generateTerminalCredential,
  hashTerminalCredential,
  terminalCredentialMatches,
} from "./pos-terminal-credential.js";
import { posPinLoginRequestSchema } from "./auth.validation.js";
import { TokenService } from "./token.service.js";
import { isPosTerminalSetupRequest } from "../../http/pos-terminal.middleware.js";
import { requirePosTerminalContext } from "../pos/access-control.helper.js";
import {
  isPosDeviceSecurityContextChanged,
  requiresClosedPosTerminalShift,
} from "../pos/auth/auth.service.js";
import { revokePosDeviceBodySchema } from "../pos/auth/auth.validation.js";

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
  [
    { ...activeTerminal, status: "inactive" as const },
    credential,
    "POS_TERMINAL_DISABLED",
  ],
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
const clearedCookie = createClearTerminalCredentialCookieHeader({
  secure: true,
});
assert.match(clearedCookie, /Max-Age=0/);
assert.match(clearedCookie, /HttpOnly/);
assert.match(clearedCookie, /Secure/);

assert.equal(
  resolveAuthCookieSecure({
    AUTH_COOKIE_SECURE: "true",
    NODE_ENV: "development",
  }),
  true,
  "AUTH_COOKIE_SECURE=true overrides a non-production NODE_ENV",
);
assert.equal(
  resolveAuthCookieSecure({
    AUTH_COOKIE_SECURE: "false",
    NODE_ENV: "production",
  }),
  false,
  "AUTH_COOKIE_SECURE=false overrides NODE_ENV when intentionally configured",
);
assert.equal(
  resolveAuthCookieSecure({ NODE_ENV: "production" }),
  true,
  "the default remains Secure in production",
);

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
  terminalCredentialVersion: 3,
});
const claims = await tokenService.verifyAccessToken(tokens.accessToken);
assert.equal(claims.terminalId, activeTerminal.id);
assert.equal(claims.terminalBranchId, activeTerminal.branchId);
assert.equal(claims.terminalCredentialVersion, 3);
assert.deepEqual(claims.branchIds, [activeTerminal.branchId]);

const adminContext = {
  userId: "01K00000000000000000000004",
  displayName: "Owner",
  tenantId: "01K00000000000000000000003",
  branchIds: [],
  role: "owner" as const,
  roles: ["owner"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const terminalRecord = {
  ...activeTerminal,
  tenantId: adminContext.tenantId,
  deviceId: "registered-device",
  label: "Front counter",
  credentialVersion: 3,
  tenantName: "Demo tenant",
  tenantCode: "CLEAN-001",
  tenantStatus: "active" as const,
  tenantDeleted: false,
  branchName: "Main branch",
  branchStatus: "active" as const,
  branchDeleted: false,
};
const bootstrapBase = {
  deviceId: terminalRecord.deviceId,
  authContext: null,
  credentialPresented: false,
  credentialTerminal: null,
  adminTerminal: null,
  adminTenant: null,
};

assert.equal(resolvePosBootstrapState(bootstrapBase).status, "unconfigured");
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    authContext: adminContext,
    adminTenant: {
      id: adminContext.tenantId,
      name: terminalRecord.tenantName,
      code: terminalRecord.tenantCode,
    },
  }).status,
  "admin_setup_required",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    authContext: adminContext,
    credentialPresented: true,
    adminTerminal: terminalRecord,
  }).status,
  "credential_lost",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    authContext: adminContext,
    credentialPresented: true,
    credentialTerminal: terminalRecord,
    adminTerminal: terminalRecord,
  }).status,
  "enrolled",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    credentialPresented: true,
    credentialTerminal: terminalRecord,
  }).status,
  "ready_for_pin",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    credentialPresented: true,
    credentialTerminal: { ...terminalRecord, status: "inactive" as const },
  }).status,
  "disabled",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    authContext: adminContext,
    credentialPresented: true,
    adminTerminal: {
      ...terminalRecord,
      status: "inactive" as const,
      credentialDigest: null,
    },
  }).status,
  "credential_lost",
  "an administrator can re-enroll a terminal whose credential was revoked",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    authContext: adminContext,
    credentialPresented: true,
    adminTerminal: {
      ...terminalRecord,
      status: "inactive" as const,
      credentialDigest: null,
      branchStatus: "inactive" as const,
    },
  }).status,
  "disabled",
  "credential re-enrollment must not bypass an inactive branch",
);
assert.equal(
  resolvePosBootstrapState({
    ...bootstrapBase,
    credentialPresented: true,
  }).status,
  "credential_lost",
);

assert.throws(
  () => requirePosTerminalContext(adminContext),
  (error) =>
    error instanceof AuthError &&
    error.code === "POS_TERMINAL_ENROLLMENT_REQUIRED",
  "an ordinary Owner session cannot enter operational POS APIs",
);
assert.doesNotThrow(() =>
  requirePosTerminalContext({
    ...adminContext,
    branchIds: [activeTerminal.branchId],
    terminalId: activeTerminal.id,
    terminalBranchId: activeTerminal.branchId,
    terminalDeviceId: terminalRecord.deviceId,
    terminalCredentialVersion: terminalRecord.credentialVersion,
  }),
);

assert.equal(
  isPosTerminalSetupRequest("POST", "/pos/auth/devices"),
  true,
  "the explicit enrollment route accepts an admin setup session",
);
assert.equal(
  isPosTerminalSetupRequest(
    "POST",
    `/pos/auth/devices/${terminalRecord.deviceId}/credential-rotation`,
  ),
  true,
  "the explicit credential recovery route accepts an admin setup session",
);
assert.equal(
  isPosTerminalSetupRequest(
    "POST",
    `/pos/auth/devices/${terminalRecord.deviceId}/revocation`,
  ),
  true,
  "the explicit terminal revocation route accepts an admin setup session",
);
assert.equal(
  isPosTerminalSetupRequest("GET", "/pos/auth/future-route"),
  false,
  "future auth routes do not silently bypass terminal enforcement",
);
assert.equal(
  isPosTerminalSetupRequest(
    "DELETE",
    `/pos/auth/devices/${terminalRecord.deviceId}`,
  ),
  false,
  "unlisted methods do not silently bypass terminal enforcement",
);

const parsedPinLogin = posPinLoginRequestSchema.parse({
  pin: "111111",
  deviceId: terminalRecord.deviceId,
  tenantCode: terminalRecord.tenantCode,
});
assert.equal(
  "tenantCode" in parsedPinLogin,
  false,
  "legacy tenantCode input is stripped and cannot select a POS tenant",
);

const mutableTerminal = {
  branchId: terminalRecord.branchId,
  status: "active" as const,
};
assert.equal(
  isPosDeviceSecurityContextChanged(mutableTerminal, {
    status: "inactive",
  }),
  true,
);
assert.equal(
  isPosDeviceSecurityContextChanged(mutableTerminal, {
    branchId: "01K00000000000000000000009",
  }),
  true,
);
assert.equal(
  isPosDeviceSecurityContextChanged(mutableTerminal, {
    branchId: mutableTerminal.branchId,
    status: mutableTerminal.status,
  }),
  false,
  "idempotent updates must not rotate the terminal session epoch",
);
assert.equal(
  requiresClosedPosTerminalShift(mutableTerminal, { status: "inactive" }),
  false,
  "security disable must force-close an open shift instead of blocking emergency lockout",
);
assert.equal(
  requiresClosedPosTerminalShift(mutableTerminal, { status: "active" }),
  false,
);
assert.equal(
  requiresClosedPosTerminalShift(mutableTerminal, {
    branchId: "01K00000000000000000000009",
  }),
  true,
);
assert.deepEqual(
  revokePosDeviceBodySchema.parse({ reason: "Device retired" }),
  {
    reason: "Device retired",
  },
);
assert.throws(() => revokePosDeviceBodySchema.parse({ reason: " " }));

console.log("POS terminal security smoke passed.");
