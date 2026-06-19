import type { AdminRole, AuthContext } from "@cleanhub/api-client";

/**
 * Session user surfaced to POS server components.
 * Mirrors the subset of AuthContext the shell needs to render the
 * signed-in profile and the logout affordance.
 */
export type PosSessionUser = {
  userId: string;
  displayName: string;
  tenantId: string | null;
  branchIds: string[];
  role: AdminRole;
  roles: string[];
  permissions: string[];
  accessTokenExpiresAt: string;
};

/** POS-allowed tenant roles. SaaS roles are rejected at the POS terminal. */
const POS_ALLOWED_ROLES: ReadonlySet<AdminRole> = new Set([
  "owner",
  "manager",
  "cashier",
]);

export function isPosAllowedRole(role: AdminRole | string): boolean {
  return POS_ALLOWED_ROLES.has(role as AdminRole);
}

export function toPosSessionUser(
  authContext: AuthContext,
): PosSessionUser | null {
  if (!isPosAllowedRole(authContext.role)) {
    return null;
  }

  return authContext;
}

export type { AuthContext };
