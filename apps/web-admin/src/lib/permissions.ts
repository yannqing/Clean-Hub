import type { AuthContext } from "@cleanhub/api-client";
import type { AdminRole, Permission } from "@cleanhub/domain";
import { isSaasAdminRole } from "@cleanhub/domain";

/**
 * Unified permission predicates for `apps/web-admin`.
 *
 * The real auth identity used throughout the app is the backend-shaped
 * {@link AuthContext} (`getCurrentAuthQuery()` / `auth.me()`). All button- and
 * action-level authorization should funnel through the helpers in this module
 * instead of being re-derived ad hoc inside each view, so the rules live in
 * exactly one place.
 *
 * The rules below intentionally combine two signals:
 *   1. the coarse `role` (e.g. `super_admin`), and
 *   2. the fine-grained `permissions[]` catalog (`Permission`).
 * This mirrors what the existing scattered checks were already doing and keeps
 * the behavior identical while consolidating the definitions.
 */

/** True when `auth` carries the given permission. Null-safe. */
export function hasPermission(
  auth: AuthContext | null,
  permission: Permission,
): boolean {
  return Boolean(auth?.permissions.includes(permission));
}

/** True when `auth.role` matches the given role. Null-safe. */
export function hasRole(auth: AuthContext | null, role: AdminRole): boolean {
  return auth?.role === role;
}

/** True when `auth.role` is a SaaS-platform staff role (super_admin / support). */
export function isSaasAdmin(auth: AuthContext | null): boolean {
  return auth ? isSaasAdminRole(auth.role) : false;
}

/**
 * True for a SaaS super admin who is not itself scoped to a tenant. This is
 * the "platform staff" signal used by every tenant-management check below.
 */
export function isPlatformSuperAdmin(auth: AuthContext | null): boolean {
  return auth?.role === "super_admin" && auth.tenantId === null;
}

/**
 * Can create new tenants. Restricted to platform-level super admins.
 */
export function canCreateTenant(auth: AuthContext | null): boolean {
  return isPlatformSuperAdmin(auth);
}

/**
 * Can edit tenant profile / settings / feature flags. Granted to platform
 * super admins OR any SaaS staff carrying the `saas:tenant:write` permission.
 */
export function canWriteTenant(auth: AuthContext | null): boolean {
  return Boolean(
    auth &&
      auth.tenantId === null &&
      (auth.role === "super_admin" ||
        auth.permissions.includes("saas:tenant:write")),
  );
}

/**
 * Can change a tenant's lifecycle status (suspend / disable / reactivate).
 * Stricter than {@link canWriteTenant}: status changes are super-admin only.
 */
export function canUpdateTenantStatus(auth: AuthContext | null): boolean {
  return isPlatformSuperAdmin(auth);
}

/**
 * Can manage SaaS member accounts (invite / edit / change roles / change
 * status). Mirrors the historical rule: super admins only, with the caller
 * additionally gating on session-load failures at the view layer.
 */
export function canManageSaasUsers(auth: AuthContext | null): boolean {
  return isPlatformSuperAdmin(auth);
}

/**
 * Can offboard a tenant, restore one inside its retention window, or export
 * its data. Offboarding starts a countdown to permanent deletion, so it is
 * held to the same bar as other destructive platform actions: super admin only.
 */
export function canOffboardTenant(auth: AuthContext | null): boolean {
  return isPlatformSuperAdmin(auth);
}
