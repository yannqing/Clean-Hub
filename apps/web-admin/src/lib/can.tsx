"use client";

import type { AuthContext } from "@cleanhub/api-client";
import type { AdminRole, Permission } from "@cleanhub/domain";
import type { ReactNode } from "react";

import {
  canCreateTenant,
  canManageSaasUsers,
  canUpdateTenantStatus,
  canWriteTenant,
  hasPermission,
  hasRole,
} from "./permissions";

/**
 * Built-in named predicates surfaced through {@link useCan} / {@link Can}.
 * Add new coarse-grained business checks to `lib/permissions.ts` and register
 * them here so they're reachable from JSX without importing ad hoc helpers.
 */
export type PermissionCheck =
  | "tenant:create"
  | "tenant:write"
  | "tenant:status"
  | "saasUsers:manage";

const namedChecks: Record<PermissionCheck, (auth: AuthContext) => boolean> = {
  "tenant:create": canCreateTenant,
  "tenant:write": canWriteTenant,
  "tenant:status": canUpdateTenantStatus,
  "saasUsers:manage": canManageSaasUsers,
};

export type CanOptions = {
  auth: AuthContext | null;

  /** Require a specific fine-grained permission from the catalog. */
  permission?: Permission;

  /** Require a specific role. */
  role?: AdminRole;

  /** Require a coarse-grained business check (e.g. `tenant:create`). */
  check?: PermissionCheck;
};

/**
 * Evaluate an authorization rule against the current {@link AuthContext}.
 *
 * Multiple conditions are ANDed together: every supplied condition must hold.
 * Pass the {@link Can} component (or this hook) the same `authContext` the
 * surrounding view already loaded, so we don't introduce hidden network calls
 * inside permission checks.
 *
 * @example
 *   const canInvite = useCan({ auth: authContext, check: "saasUsers:manage" });
 */
export function useCan({ auth, permission, role, check }: CanOptions): boolean {
  if (!auth) {
    return false;
  }

  if (permission && !hasPermission(auth, permission)) {
    return false;
  }

  if (role && !hasRole(auth, role)) {
    return false;
  }

  if (check && !namedChecks[check](auth)) {
    return false;
  }

  return true;
}

export type CanProps = CanOptions & {
  /** Shown when the check passes. Mutually exclusive with `fallback` + children. */
  children?: ReactNode;

  /** Shown when the check fails. Defaults to `null`. */
  fallback?: ReactNode;
};

/**
 * Render-guard component for button-level authorization.
 *
 * Prefer this over scattering `canManageMember ? <X /> : null` ternaries
 * across views. It evaluates the same rule set as {@link useCan} and renders
 * either its children or the `fallback`.
 *
 * @example
 *   <Can auth={authContext} check="tenant:create">
 *     <Button>New tenant</Button>
 *   </Can>
 */
export function Can({ children, fallback = null, ...options }: CanProps) {
  return useCan(options) ? <>{children}</> : <>{fallback}</>;
}
