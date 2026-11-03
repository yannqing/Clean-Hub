/**
 * Admin role catalog — the single source of truth for the role strings the
 * auth backend may assign to a user (`AuthContext.role`).
 *
 * The runtime array (`ADMIN_ROLES`) is the source; `AdminRole` is derived from
 * it. `@cleanhub/api-client` and `apps/web-admin` re-export from here so the
 * role set can't silently drift between packages.
 *
 * Roles are split into two scopes:
 * - {@link SAAS_ADMIN_ROLES}: SaaS platform staff who land in `/saas/**`.
 * - {@link TENANT_ROLES}: tenant staff who land in `/tenant/**`.
 */
export const ADMIN_ROLES = [
  "super_admin",
  "support",
  "owner",
  "manager",
  "cashier",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** SaaS-platform staff roles. Users with these roles are routed to `/saas/**`. */
export const SAAS_ADMIN_ROLES = ["super_admin", "support"] as const;

/** Tenant-scope roles. Users with these roles are routed to `/tenant/**`. */
export const TENANT_ROLES = ["owner", "manager", "cashier"] as const;

export type SaasAdminRole = (typeof SAAS_ADMIN_ROLES)[number];
export type TenantRole = (typeof TENANT_ROLES)[number];

/**
 * True for SaaS-platform staff roles (super_admin / support). Used by the
 * `web-admin` proxy to route users between `/saas/**` and `/tenant/**`, and by
 * feature-level permission checks.
 */
export function isSaasAdminRole(role: string): role is SaasAdminRole {
  return (SAAS_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * True for tenant-scope roles (owner / manager / cashier).
 */
export function isTenantRole(role: string): role is TenantRole {
  return (TENANT_ROLES as readonly string[]).includes(role);
}

/**
 * Type guard for narrowing an arbitrary string into a known {@link AdminRole}.
 */
export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}
