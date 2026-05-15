import { AuthError } from "./auth.errors.js";
import type { AdminRole, AuthContext } from "./auth.types.js";

export type SaasRole = Extract<AdminRole, "super_admin" | "support">;

const SAAS_ROLES: SaasRole[] = ["super_admin", "support"];

export function assertSaasContext(authContext: AuthContext): void {
  if (!SAAS_ROLES.includes(authContext.role as SaasRole)) {
    throw new AuthError("FORBIDDEN", "User cannot access SaaS resources.");
  }
}

export function requireSaasRole(
  authContext: AuthContext,
  allowedRoles: SaasRole[],
): void {
  assertSaasContext(authContext);

  if (!allowedRoles.includes(authContext.role as SaasRole)) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export function requireSuperAdmin(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin"]);
}

export function hasPermission(
  authContext: AuthContext,
  permissionCode: string,
): boolean {
  return authContext.permissions.includes(permissionCode);
}

export function requirePermission(
  authContext: AuthContext,
  permissionCode: string,
): void {
  if (!hasPermission(authContext, permissionCode)) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}

export function requireAnyPermission(
  authContext: AuthContext,
  permissionCodes: string[],
): void {
  if (!permissionCodes.some((code) => hasPermission(authContext, code))) {
    throw new AuthError("FORBIDDEN", "User does not have enough permission.");
  }
}
