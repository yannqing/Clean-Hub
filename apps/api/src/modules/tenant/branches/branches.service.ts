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
  securityForceClosePosTerminalRegisterSessions,
  securityForceClosePosTerminalShifts,
} from "../../pos/terminal-lifecycle/terminal-lifecycle.repository.js";
import { MediaService } from "../../media/media.service.js";
import { MediaError, type MediaUploadTicket } from "../../media/media.types.js";
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
  BranchLogoUploadTicket,
  BranchRequestInput,
  BranchSummary,
  CreateBranchRequest,
  RequestBranchLogoUpload,
  UpdateBranchRequest,
  UpdateBranchStatusRequest,
} from "./branches.types.js";

const BRANCH_LOGO_PURPOSE = "branch_logo";

type BranchLogoMediaService = Pick<
  MediaService,
  | "requestUpload"
  | "assertOwnedAndCommit"
  | "createDownloadLinkForKnownCommittedObject"
>;

function mapBranchLogoMediaError(error: MediaError): TenantBranchesError {
  return new TenantBranchesError(
    "BRANCH_LOGO_INVALID",
    error.message,
    error.status,
  );
}

async function commitBranchLogo(
  mediaService: BranchLogoMediaService,
  input: {
    tenantId: string;
    actorUserId: string;
    objectKey: string | null | undefined;
  },
): Promise<void> {
  if (!input.objectKey) {
    return;
  }

  try {
    await mediaService.assertOwnedAndCommit({
      tenantId: input.tenantId,
      objectKey: input.objectKey,
      expectedPurpose: BRANCH_LOGO_PURPOSE,
      expectedCreatedBy: input.actorUserId,
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapBranchLogoMediaError(error);
    }

    throw error;
  }
}

async function withBranchLogoUrl(
  branch: BranchSummary,
  tenantId: string,
  mediaService: BranchLogoMediaService,
): Promise<BranchSummary> {
  if (!branch.logoObjectKey) {
    return branch;
  }

  try {
    const ticket = await mediaService.createDownloadLinkForKnownCommittedObject(
      {
        tenantId,
        objectKey: branch.logoObjectKey,
      },
    );

    return { ...branch, logoUrl: ticket.downloadUrl };
  } catch {
    return { ...branch, logoUrl: null };
  }
}

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
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchSummary[]> {
  const tenantId = await assertBranchManagementAccess(authContext, db);
  const branchScope = await resolveAllowedBranchIds(authContext, db);

  const branchList = await findBranches(db, {
    ...input,
    tenantId,
    allowedBranchIds: branchScope === "all" ? undefined : branchScope,
  });

  return Promise.all(
    branchList.map((branch) =>
      withBranchLogoUrl(branch, tenantId, mediaService),
    ),
  );
}

export async function getTenantBranchDetail(
  authContext: BranchRequestInput<unknown>["authContext"],
  branchId: string,
  db: Database = getDb(),
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(authContext, db);
  await assertAuthorizedBranch(authContext, branchId, db);

  const branch = await requireBranch(db, {
    tenantId,
    branchId,
  });

  return withBranchLogoUrl(branch, tenantId, mediaService);
}

export async function createTenantBranch(
  input: BranchRequestInput<CreateBranchRequest>,
  db: Database = getDb(),
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchCreationAccess(input.authContext, db);

  await commitBranchLogo(mediaService, {
    tenantId,
    actorUserId: input.authContext.userId,
    objectKey: input.data.logoObjectKey,
  });

  const branch = await db.transaction(async (tx) => {
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

  return withBranchLogoUrl(branch, tenantId, mediaService);
}

export async function updateTenantBranch(
  branchId: string,
  input: BranchRequestInput<UpdateBranchRequest>,
  db: Database = getDb(),
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(input.authContext, db);

  await assertAuthorizedBranch(input.authContext, branchId, db);
  const currentBranch = await requireBranch(db, { tenantId, branchId });

  if (input.data.logoObjectKey !== currentBranch.logoObjectKey) {
    await commitBranchLogo(mediaService, {
      tenantId,
      actorUserId: input.authContext.userId,
      objectKey: input.data.logoObjectKey,
    });
  }

  const branch = await db.transaction(async (tx) => {
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

  return withBranchLogoUrl(branch, tenantId, mediaService);
}

export async function updateTenantBranchStatus(
  branchId: string,
  input: BranchRequestInput<UpdateBranchStatusRequest>,
  db: Database = getDb(),
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchSummary> {
  const tenantId = await assertBranchManagementAccess(input.authContext, db);

  const branch = await db.transaction(async (tx) => {
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
      const finalLockedTerminals = await lockPosTerminalsForBranchStatusChange(
        tx,
        {
          tenantId,
          branchId,
        },
      );

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
        await securityForceClosePosTerminalRegisterSessions(tx, {
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

  return withBranchLogoUrl(branch, tenantId, mediaService);
}

export async function requestTenantBranchLogoUpload(
  authContext: BranchRequestInput<unknown>["authContext"],
  data: RequestBranchLogoUpload,
  db: Database = getDb(),
  mediaService: BranchLogoMediaService = new MediaService(),
): Promise<BranchLogoUploadTicket> {
  const tenantId = await assertBranchManagementAccess(authContext, db);

  try {
    const ticket: MediaUploadTicket = await mediaService.requestUpload({
      tenantId,
      actorUserId: authContext.userId,
      purpose: BRANCH_LOGO_PURPOSE,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
    });

    return ticket;
  } catch (error) {
    if (error instanceof MediaError) {
      throw mapBranchLogoMediaError(error);
    }

    throw error;
  }
}
