import { and, eq } from "drizzle-orm";

import { getDb, userBranches, type Database } from "@cleanhub/db";

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

  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(
      and(
        eq(userBranches.userId, authContext.userId),
        eq(userBranches.tenantId, authContext.tenantId!),
      ),
    );

  return rows.map((row) => row.branchId);
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
