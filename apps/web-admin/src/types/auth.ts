/**
 * Auth type surface for `apps/web-admin`.
 *
 * The canonical `Permission` / `AdminRole` catalogs live in
 * `@cleanhub/domain` and are re-exported here (and from `@cleanhub/api-client`)
 * so that this app has a single source of truth shared with the backend RBAC
 * contract. Prefer importing from `@cleanhub/api-client` in feature code; this
 * module exists for legacy paths that still import from `@/types/auth`.
 */
export type { AdminRole, Permission } from "@cleanhub/domain";

import type { AdminRole, Permission } from "@cleanhub/domain";

export type AdminScope = "saas" | "tenant";

/**
 * Frontend-facing session user. NOTE: most of the codebase consumes the
 * backend-shaped {@link import("@cleanhub/api-client").AuthContext} directly.
 * `SessionUser` is retained for the legacy `lib/session.ts` surface and for
 * `hasPermission`'s historical signature; both are kept generic over a
 * permissions-bearing user shape so they can be used with either type.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  scope: AdminScope;
  tenantId?: string;
  branchIds: string[];
  permissions: Permission[];
  role?: AdminRole;
};
