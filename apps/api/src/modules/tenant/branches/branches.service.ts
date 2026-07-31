import { getDb, type Database } from "@cleanhub/db";

import { BranchScopeError } from "../../auth/branch-scope.errors.js";
import {
  assertBranchAccess,
  resolveAllowedBranchIds,
} from "../../auth/branch-scope.helper.js";
import {
  assertActiveTenant,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import {
  invalidateLockedPosTerminalsForBranchStatusChange,
  lockPosTerminalsForBranchStatusChange,
  securityForceClosePosTerminalShifts,
} from "../../pos/terminal-lifecycle/terminal-lifecycle.repository.js";
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

async function assertBranchCreationAccess(
  authContext: BranchRequestInput<unknown>["authContext"],
  db: Database,
): Promise<string> {
  requireTenantRole(authContext, ["owner"]);
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
  const tenantId = await assertBranchCreationAccess(input.authContext, db);

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
    const statusChanged = before.status !== input.data.status;

    // Lock terminals before the branch UPDATE. POS clock-in also starts by
    // locking its terminal, so this preserves one lock order and guarantees
    // that any shift created by an in-flight request is visible to (and closed
    // by) the branch-disable lifecycle below.
    if (statusChanged) {
      await lockPosTerminalsForBranchStatusChange(tx, {
        tenantId,
        branchId,
      });
    }

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

    if (statusChanged) {
      // The branch row is now write-locked. Re-read the terminal set to catch
      // a new enrollment or inbound rebind that committed after the first
      // terminal scan but before the branch UPDATE acquired its row lock.
      const finalLockedTerminals =
        await lockPosTerminalsForBranchStatusChange(tx, {
          tenantId,
          branchId,
        });

      if (input.data.status === "inactive") {
        await securityForceClosePosTerminalShifts(tx, {
          tenantId,
          terminalIds: finalLockedTerminals.map((terminal) => terminal.id),
          actorUserId: input.authContext.userId,
          reason: "The branch was disabled.",
          metadata: {
            securityTrigger: "branch_status_change",
            branchId,
            branchStatus: input.data.status,
          },
          requestMeta: input.requestMeta,
        });
      }

      await invalidateLockedPosTerminalsForBranchStatusChange(tx, {
        tenantId,
        branchId,
        branchStatus: input.data.status,
        actorUserId: input.authContext.userId,
        terminals: finalLockedTerminals,
        requestMeta: input.requestMeta,
      });
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
