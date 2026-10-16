import type { AdminRole, AuthenticatedUser } from "./auth.types.js";

export type RoleAssignmentIdentity = {
  roleScope: "saas" | "tenant" | "pos";
  roleTenantId: string | null;
  assignmentTenantId: string | null;
  branchId: string | null;
};

export type LoginSessionKind = "web" | "pos";

export function isUserIdentityShapeValid(user: AuthenticatedUser): boolean {
  return user.userType === "saas"
    ? user.tenantId === null
    : user.tenantId !== null;
}

export function isRoleAssignmentConsistent(
  user: AuthenticatedUser,
  assignment: RoleAssignmentIdentity,
): boolean {
  if (user.userType === "saas") {
    return (
      user.tenantId === null &&
      assignment.roleScope === "saas" &&
      assignment.roleTenantId === null &&
      assignment.assignmentTenantId === null &&
      assignment.branchId === null
    );
  }

  return (
    user.tenantId !== null &&
    (assignment.roleScope === "tenant" || assignment.roleScope === "pos") &&
    assignment.roleTenantId === user.tenantId &&
    assignment.assignmentTenantId === user.tenantId
  );
}

export function isRoleAssignmentAvailableForSession(
  user: AuthenticatedUser,
  assignment: RoleAssignmentIdentity,
  sessionKind: LoginSessionKind,
): boolean {
  if (user.userType === "saas") {
    return sessionKind === "web" && assignment.roleScope === "saas";
  }

  return sessionKind === "web"
    ? assignment.roleScope === "tenant"
    : assignment.roleScope === "tenant" || assignment.roleScope === "pos";
}

export function resolveSessionPrimaryRole(
  user: AuthenticatedUser,
  roles: readonly string[],
  sessionKind: LoginSessionKind,
): AdminRole | null {
  const rolePriority: AdminRole[] =
    user.userType === "saas"
      ? ["super_admin", "support"]
      : sessionKind === "pos"
        ? ["owner", "manager", "cashier"]
        : ["owner", "manager"];

  return rolePriority.find((candidate) => roles.includes(candidate)) ?? null;
}

export function isWebRoleBranchScopeValid(
  role: AdminRole,
  branchIds: readonly string[],
): boolean {
  return role !== "manager" || new Set(branchIds).size === 1;
}
