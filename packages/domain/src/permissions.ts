/**
 * Permission catalog — the single source of truth for authorization
 * permission strings across CleanHub apps.
 *
 * The runtime array (`PERMISSIONS`) is the source; the `Permission` type is
 * derived from it so adding/removing a permission only requires editing one
 * line. `@cleanhub/api-client` and `apps/web-admin` both re-export from here
 * rather than maintaining their own literal unions, which prevents drift
 * between the backend RBAC contract and the frontend checks.
 *
 * Convention: `"<scope>:<resource>:<action>"` (e.g. `"saas:tenant:write"`).
 */
export const PERMISSIONS = [
  // SaaS platform scope
  "saas:tenant:read",
  "saas:tenant:write",
  "saas:user:manage",
  "saas:audit:read",

  // Tenant scope
  "tenant:branch:manage",
  "tenant:user:manage",
  "tenant:catalog:manage",
  "tenant:hardware:manage",
  "tenant:report:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Type guard for narrowing an arbitrary string (e.g. coming from a backend
 * payload) into a known {@link Permission}. Strings outside the catalog are
 * rejected rather than silently passed through.
 */
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Filter a list of arbitrary permission strings down to the typed catalog.
 * Useful when hydrating an `AuthContext` from an untyped API response.
 */
export function filterPermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}
