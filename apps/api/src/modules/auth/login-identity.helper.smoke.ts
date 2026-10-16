import assert from "node:assert/strict";

import type { AuthenticatedUser } from "./auth.types.js";
import {
  isRoleAssignmentAvailableForSession,
  isRoleAssignmentConsistent,
  isUserIdentityShapeValid,
  isWebRoleBranchScopeValid,
  resolveSessionPrimaryRole,
} from "./login-identity.helper.js";
import { isNormalizedEmailUniqueViolation } from "./email-identity.helper.js";
import { buildLoginLockKey } from "./login-lockout.helper.js";
import { loginRequestSchema } from "./auth.validation.js";

const saasUser: AuthenticatedUser = {
  id: "01K00000000000000000000001",
  tenantId: null,
  userType: "saas",
  email: "admin@example.com",
  passwordHash: "hash",
  pinHash: "hash",
  status: "active",
};
const tenantUser: AuthenticatedUser = {
  ...saasUser,
  id: "01K00000000000000000000002",
  tenantId: "01K00000000000000000000003",
  userType: "tenant",
  email: "owner@example.com",
};

assert.equal(isUserIdentityShapeValid(saasUser), true);
assert.equal(isUserIdentityShapeValid(tenantUser), true);
assert.equal(
  isUserIdentityShapeValid({ ...tenantUser, tenantId: null }),
  false,
);

assert.equal(
  isRoleAssignmentConsistent(saasUser, {
    roleScope: "saas",
    roleTenantId: null,
    assignmentTenantId: null,
    branchId: null,
  }),
  true,
);
assert.equal(
  isRoleAssignmentConsistent(tenantUser, {
    roleScope: "tenant",
    roleTenantId: tenantUser.tenantId,
    assignmentTenantId: tenantUser.tenantId,
    branchId: null,
  }),
  true,
);
const tenantPosAssignment = {
  roleScope: "pos" as const,
  roleTenantId: tenantUser.tenantId,
  assignmentTenantId: tenantUser.tenantId,
  branchId: "01K00000000000000000000005",
};
assert.equal(
  isRoleAssignmentConsistent(tenantUser, tenantPosAssignment),
  true,
);
assert.equal(
  isRoleAssignmentAvailableForSession(
    tenantUser,
    tenantPosAssignment,
    "web",
  ),
  false,
);
assert.equal(
  isRoleAssignmentAvailableForSession(
    tenantUser,
    tenantPosAssignment,
    "pos",
  ),
  true,
);
assert.equal(
  isRoleAssignmentConsistent(tenantUser, {
    roleScope: "tenant",
    roleTenantId: "01K00000000000000000000004",
    assignmentTenantId: tenantUser.tenantId,
    branchId: null,
  }),
  false,
);

assert.equal(
  resolveSessionPrimaryRole(saasUser, ["support"], "web"),
  "support",
);
assert.equal(resolveSessionPrimaryRole(tenantUser, ["cashier"], "web"), null);
assert.equal(
  resolveSessionPrimaryRole(tenantUser, ["cashier"], "pos"),
  "cashier",
);
assert.equal(isWebRoleBranchScopeValid("manager", []), false);
assert.equal(
  isWebRoleBranchScopeValid("manager", ["01K00000000000000000000005"]),
  true,
);
assert.equal(
  isWebRoleBranchScopeValid("manager", [
    "01K00000000000000000000005",
    "01K00000000000000000000006",
  ]),
  false,
);
assert.equal(isWebRoleBranchScopeValid("owner", []), true);

assert.equal(
  isNormalizedEmailUniqueViolation({
    cause: {
      code: "23505",
      constraint: "users_normalized_email_unique",
    },
  }),
  true,
);
assert.equal(
  isNormalizedEmailUniqueViolation({
    code: "23505",
    constraint: "users_tenant_normalized_email_unique",
  }),
  false,
);
assert.equal(
  loginRequestSchema.safeParse({
    identifier: "OWNER@EXAMPLE.COM",
    password: "secret",
  }).success,
  true,
);
assert.equal(
  loginRequestSchema.safeParse({
    identifier: "+8613800000000",
    password: "secret",
  }).success,
  false,
);
assert.equal(
  buildLoginLockKey("owner@example.com"),
  "global:owner@example.com",
);
assert.equal(
  buildLoginLockKey("mobile:owner:owner@example.com", "CLEAN-001"),
  "clean-001:mobile:owner:owner@example.com",
);

if (process.argv[1]?.endsWith("login-identity.helper.smoke.ts")) {
  process.stdout.write("login identity helper smoke passed\n");
}
