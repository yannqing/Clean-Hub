import { getDb, type Database } from "@cleanhub/db";

import { BranchScopeError } from "../auth/branch-scope.errors.js";
import {
  assertBranchAccess,
  resolveAllowedBranchIds,
} from "../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../auth/permission.helper.js";
import { TenantBranchesError } from "./branches.errors.js";
import {
  assignBranchToUser,
  createBranchRecord,
  findBranchById,
  findBranches,
  updateBranchRecord,
  updateBranchStatusRecord,
  writeBranchCreatedAuditLog,
  writeBranchStatusChangedAuditLog,
  writeBranchUpdatedAuditLog,
} from "./branches.repository.js";
import type {
  BranchListInput,
  BranchRequestInput,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types.js";

async function assertBranchManagementAccess(
  authContext: BranchRequestInput<unknown>["authContext"],
  db: Database,
): Promise<string> {
  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);

  return authContext.tenantId!;
}

async function assertBranchCreationAccess(
  authContext: BranchRequestInput<unknown>["authContext"],
  db: Database,
): Promise<string> {
  requireTenantRole(authContext, ["owner"]);
  await assertActiveTenant(authContext, db);

  return authContext.tenantId!;
}

async function requireScopedBranchAccess(
  authContext: BranchRequestInput<unknown>["authContext"],
  branchId: string,
  db: Database,
): Promise<void> {
  try {
    await assertBranchAccess(authContext, branchId, db);
  } catch (error) {
    if (error instanceof BranchScopeError) {
      throw new TenantBranchesError(
        "BRANCH_NOT_FOUND",
        "Branch was not found.",
        404,
      );
    }
    throw error;
  }
}

async function requireBranch(
  db: Database,
  input: { tenantId: string; branchId: string },
): Promise<BranchSummary> {
  const branch = await findBranchById(db, input);

  if (!branch) {
    throw new TenantBranchesError(
      "BRANCH_NOT_FOUND",
      "Branch was not found.",
      404,
    );
  }

  return branch;
}

export async function listTenantBranches(
  authContext: BranchRequestInput<unknown>["authContext"],
  input: BranchListInput,
  db: Database = getDb(),
): Promise<BranchSummary[]> {
  const tenantId = await assertBranchManagementAccess(authContext, db);
  const branchScope = await resolveAllowedBranchIds(authContext, db);

  return findBranches(db, {
    ...input,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
    tenantId,
  });
}

export async function getTenantBranchDetail(
  authContext: BranchRequestInput<unknown>["authContext"],
  branchId: string,
  db: Database = getDb(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(authContext, db);
  await requireScopedBranchAccess(authContext, branchId, db);

  return requireBranch(db, {
    tenantId,
    branchId,
  });
}

export async function createTenantBranch(
  input: BranchRequestInput<CreateBranchRequest>,
  db: Database