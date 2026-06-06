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

async function assertAuthorizedBranch(
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
    tenantId,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  });
}

export async function getTenantBranchDetail(
  authContext: BranchRequestInput<unknown>["authContext"],
  branchId: string,
  db: Database = getDb(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(authContext, db);
  await assertAuthorizedBranch(authContext, branchId, db);

  return requireBranch(db, {
    tenantId,
    branchId,
  });
}

export async function createTenantBranch(
  input: BranchRequestInput<CreateBranchRequest>,
  db: Database = getDb(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(input.authContext, db);

  return db.transaction(async (tx) => {
    const branch = await createBranchRecord(tx, {
      ...input.data,
      tenantId,
      actorUserId: input.authContext.userId,
    });

    await writeBranchCreatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      branch,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return branch;
  });
}

export async function updateTenantBranch(
  branchId: string,
  input: BranchRequestInput<UpdateBranchRequest>,
  db: Database = getDb(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(input.authContext, db);

  return db.transaction(async (tx) => {
    await assertAuthorizedBranch(input.authContext, branchId, tx);
    const before = await requireBranch(tx, {
      tenantId,
      branchId,
    });
    const branch = await updateBranchRecord(tx, {
      tenantId,
      branchId,
      actorUserId: input.authContext.userId,
      current: before,
      data: input.data,
    });

    if (!branch) {
      throw new TenantBranchesError(
        "BRANCH_NOT_FOUND",
        "Branch was not found.",
        404,
      );
    }

    await writeBranchUpdatedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      before,
      after: branch,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return branch;
  });
}

export async function updateTenantBranchStatus(
  branchId: string,
  input: BranchRequestInput<UpdateBranchStatusRequest>,
  db: Database = getDb(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(input.authContext, db);

  return db.transaction(async (tx) => {
    await assertAuthorizedBranch(input.authContext, branchId, tx);
    const before = await requireBranch(tx, {
      tenantId,
      branchId,
    });
    const branch = await updateBranchStatusRecord(tx, {
      tenantId,
      branchId,
      actorUserId: input.authContext.userId,
      status: input.data.status,
      version: input.data.version,
    });

    if (!branch) {
      throw new TenantBranchesError(
        "BRANCH_NOT_FOUND",
        "Branch was not found.",
        404,
      );
    }

    await writeBranchStatusChangedAuditLog(tx, {
      actorUserId: input.authContext.userId,
      tenantId,
      before,
      after: branch,
      ipAddress: input.requestMeta?.ipAddress,
      userAgent: input.requestMeta?.userAgent,
    });

    return branch;
  });
}
