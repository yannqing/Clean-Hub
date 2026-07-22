import assert from "node:assert/strict";

import type { AuthContext } from "../auth/auth.types.js";
import { AuthError } from "../auth/auth.errors.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requireAnyPosBranchAccess,
  requirePosBranchAccess,
  resolvePosBranchScope,
} from "./access-control.helper.js";

function context(
  role: AuthContext["role"],
  branchIds: string[],
  terminalBranchId?: string,
): AuthContext {
  return {
    userId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    displayName: "POS smoke user",
    tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    branchIds,
    role,
    roles: [role],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...(terminalBranchId ? { terminalBranchId } : {}),
  } as AuthContext;
}

function expectForbidden(callback: () => unknown): void {
  assert.throws(callback, (error: unknown) => {
    return error instanceof AuthError && error.code === "FORBIDDEN";
  });
}

const branchA = "01ARZ3NDEKTSV4RRFFQ69G5FAX";
const branchB = "01ARZ3NDEKTSV4RRFFQ69G5FAY";
const entityIdForAudit = "01ARZ3NDEKTSV4RRFFQ69G5FAZ";

assert.equal(resolvePosBranchScope(context("owner", [])), undefined);
assert.deepEqual(resolvePosBranchScope(context("manager", [])), []);
assert.deepEqual(
  resolvePosBranchScope(context("manager", [branchA, branchA, branchB])),
  [branchA, branchB],
);
assert.deepEqual(
  resolvePosBranchScope(context("owner", [], branchA)),
  [branchA],
);
assert.deepEqual(
  resolvePosBranchScope(context("manager", [branchA, branchB], branchA)),
  [branchA],
);

expectForbidden(() => requireAnyPosBranchAccess(context("cashier", [])));
expectForbidden(() =>
  requirePosBranchAccess(context("manager", [branchA]), branchB),
);
expectForbidden(() =>
  requirePosBranchAccess(
    context("manager", [branchA, branchB], branchA),
    branchB,
  ),
);

expectForbidden(() =>
  authorizePosSensitiveOperation(context("cashier", [branchA]), "delete", "duplicate"),
);
expectForbidden(() =>
  authorizePosSensitiveOperation(
    context("cashier", [branchA]),
    "price_override",
    "customer-approved discount",
  ),
);
assert.equal(
  authorizePosSensitiveOperation(
    context("manager", [branchA]),
    "delete",
    "  duplicate account  ",
  ),
  "duplicate account",
);
assert.equal(
  authorizePosSensitiveOperation(
    context("manager", [branchA]),
    "price_override",
    "  customer-approved discount  ",
  ),
  "customer-approved discount",
);
assert.throws(() =>
  authorizePosSensitiveOperation(context("manager", [branchA]), "delete", "   "),
);

assert.deepEqual(
  createPosAuditMetadata(
    {
      ...context("cashier", [branchA], branchA),
      terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
      terminalDeviceId: "device-01",
    },
    { itemId: entityIdForAudit },
  ),
  {
    itemId: entityIdForAudit,
    terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
    terminalBranchId: branchA,
    terminalDeviceId: "device-01",
  },
);

console.log("POS access-control smoke passed.");
