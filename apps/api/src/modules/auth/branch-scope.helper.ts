import { and, eq, isNotNull, isNull } from "drizzle-orm";

import {
  getDb,
  roles,
  userBranches,
  userRoles,
  type Database,
} from "@cleanhub/db";

import { BranchScopeError } from "./branch-scope.errors.js";
import { AuthError } from "./auth.errors.js";
import { assertTenantContext } from "./permission.helper.js";
import type { AuthContext } from "./auth.types.js";

export type AllowedBranchScope = "all" | string[];

export async function resolveAllowedBranchIds(
  authContext: AuthContext,
  db: Database = getDb(),
): Promise<AllowedBranchScope> {
  assertTenantContext(authContext);

  if (authContext.role === "owner") {
    return "all";
  }

  const [directBranchRows, roleBranchRows] = await Promise.all([
    db
      .select({ branchId: userBranches.branchId })
      .from(userBranches)
      .where(
        and(
          eq(userBranches.userId, authContext.userId),
          eq(userBranches.tenantId, authContext.tenantId!),
        ),
      ),
    db
      .select({ branchId: userRoles.branchId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(userRoles.userId, authContext.userId),
          eq(userRoles.tenantId, authContext.tenantId!),
          isNotNull(userRoles.branchId),
          isNull(userRoles.revokedAt),
          eq(roles.status, "active"),
          isNull(roles.deletedAt),
        ),
      ),
  ]);

  return [
    ...new Set(
      [...directBranchRows, ...roleBranchRows]
        .map((row) => row.branchId)
        .filter((branchId): branchId is string => Boolean(branchId)),
    ),
  ];
}

export async function assertBranchAccess(
  authContext: AuthContext,
  branchId: string,
  db: Database = getDb(),
): Promise<void> {
  const allowed = await resolveAllowedBranchIds(authContext, db);

  if (allowed === "all") {
    return;
  }

  if (!allowed.includes(branchId)) {
    throw new BranchScopeError(
      "BRANCH_NOT_FOUND",
      "Branch was not found.",
      404,
    );
  }
}

export async function assertBranchIdsSubset(
  authContext: AuthContext,
  branchIds: string[],
  db: Database = getDb(),
): Promise<void> {
  if (branchIds.length === 0) {
    return;
  }

  const allowed = await resolveAllowedBranchIds(authContext, db);

  if (allowed === "all") {
    return;
  }

  const hasUnauthorizedBranch = branchIds.some(
    (branchId) => !allowed.includes(branchId),
  );

  if (hasUnauthorizedBranch) {
    throw new AuthError(
      "FORBIDDEN",
      "Branch assignment exceeds allowed scope.",
    );
  }
}
