import { AuthError } from "../../auth/auth.errors.js";
import {
  requireSaasRole,
  type SaasRole,
} from "../../auth/permission.helper.js";
import type { AuthContext } from "../../auth/auth.types.js";

export function requireSaasUsersAccess(
  authContext: AuthContext,
  allowedRoles: SaasRole[],
): void {
  requireSaasRole(authContext, allowedRoles);
  if (authContext.tenantId !== null) {
    throw new AuthError("FORBIDDEN", "Tenant users cannot access SaaS users.");
  }
}
