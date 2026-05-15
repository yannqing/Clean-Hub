import { AuthError } from "./auth.errors.js";
import type { AdminRole, AuthContext } from "./auth.types.js";

export type SaasRole = Extract<AdminRole, "super_admin" | "support">;
export type SaasAuthContext = AuthContext & {
  tenantId: null;
  role: SaasRole;
};

export const SAAS_ROLES = [
  "super_admin",
  "support",
] as const satisfies readonly SaasRole[];

const SAAS_READ_ROLES = SAAS_ROLES;
const SAAS_WRITE_ROLES = ["super_admin"] as const satisfies readonly SaasRole[];

export const SAAS_OPERATION_ROLES = {
  "saas.overview.read": SAAS_READ_ROLES,
  "saas.tenants.read": SAAS_READ_ROLES,
  "saas.tenants.create": SAAS_WRITE_ROLES,
  "saas.tenants.update": SAAS_WRITE_ROLES,
  "saas.tenants.suspend": SAAS_WRITE_ROLES,
  "saas.users.read": SAAS_READ_ROLES,
  "saas.users.manage": SAAS_WRITE_ROLES,
  "saas.audit.read": SAAS_READ_ROLES,
  "saas.backup.create": SAAS_WRITE_ROLES,
  "saas.restore.request": SAAS_WRITE_ROLES,
  "saas.security.update": SAAS_WRITE_ROLES,
} as const satisfies Record<string, readonly SaasRole[]>;

export type SaasOperation = keyof typeof SAAS_OPERATION_ROLES;

export function isSaasRole(role: AdminRole): role is SaasRole {
  return SAAS_ROLES.includes(role as SaasRole);
}

export function isSaasAuthContext(
  authContext: AuthContext,
): authContext is SaasAuthContext {
  return authContext.tenantId === null && isSaasRole(authContext.role);
}

export function assertSaasContext(
  authContext: AuthContext,
): asserts authContext is SaasAuthContext {
  if (!isSaasAuthContext(authContext)) {
    throw new AuthError("FORBIDDEN", "SaaS context is required.");
  }
}

export function requireSaasRole(
  authContext: AuthContext,
  allowedRoles: readonly SaasRole[],
): void {
  assertSaasContext(authContext);

  if (!allowedRoles.includes(authContext.role)) {
    throw new AuthError(
      "FORBIDDEN",
      "User does not have permission for this SaaS operation.",
    );
  }
}

export function requireSuperAdmin(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin"]);
}

export function canAccessSaasOperation(
  authContext: AuthContext,
  operation: SaasOperation,
): boolean {
  const allowedRoles: readonly SaasRole[] = SAAS_OPERATION_ROLES[operation];

  return (
    isSaasAuthContext(authContext) &&
    allowedRoles.includes(authContext.role)
  );
}

export function requireSaasOperation(
  authContext: AuthContext,
  operation: SaasOperation,
): void {
  if (!canAccessSaasOperation(authContext, operation)) {
    throw new AuthError(
      "FORBIDDEN",
      `User does not have permission for SaaS operation: ${operation}.`,
    );
  }
}
