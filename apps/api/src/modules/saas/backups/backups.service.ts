import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  requireSaasRole,
  requireSuperAdmin,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { writeOperationLog } from "../ops/operation-logs.helper.js";
import { BackupsError } from "./backups.errors.js";
import {
  backupTenantExists,
  findBackupJobForRestoreById,
  findBackupJobs,
  findRestoreRequestForReview,
  findRestoreRequests,
  insertBackupJob,
  insertRestoreRequest,
  transitionRestoreRequest,
} from "./backups.repository.js";
import type {
  BackupJobListInput,
  BackupJobListItem,
  CreateBackupJobInput,
  CreateRestoreRequestInput,
  RestoreRequestListInput,
  RestoreRequestListItem,
  ReviewRestoreRequestAction,
} from "./backups.types.js";

type RequestMeta = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

function requireBackupAccess(authContext: AuthContext): void {
  requireSaasRole(authContext, ["super_admin", "support"]);
}

export async function listBackupJobs(
  authContext: AuthContext,
  input: BackupJobListInput,
  db: Database = getDb(),
): Promise<BackupJobListItem[]> {
  requireBackupAccess(authContext);

  return findBackupJobs(db, input);
}

export async function createBackupJob(
  authContext: AuthContext,
  input: CreateBackupJobInput,
  requestMeta: RequestMeta = {},
  db: Database = getDb(),
): Promise<BackupJobListItem> {
  requireBackupAccess(authContext);

  return db.transaction(async (tx) => {
    if (
      input.scope === "tenant" &&
      (!input.tenantId || !(await backupTenantExists(tx, input.tenantId)))
    ) {
      throw new BackupsError(
        "BACKUP_TENANT_NOT_FOUND",
        "Tenant was not found.",
        404,
      );
    }
    const backupJob = await insertBackupJob(tx, {
      ...input,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId: backupJob.tenantId,
      eventCategory: "saas_backups",
      eventType: "backup_job.created",
      entityType: "backup_job",
      entityId: backupJob.id,
      reason: input.reason,
      after: {
        scope: backupJob.scope,
        status: backupJob.status,
        tenantId: backupJob.tenantId,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    await writeOperationLog(tx, {
      tenantId: backupJob.tenantId,
      level: "info",
      service: "saas-backups",
      eventType: "backup_job.created",
      message: "Backup job was queued for the PostgreSQL backup worker.",
      requestId: requestMeta.requestId,
      actorUserId: authContext.userId,
      metadata: {
        backupJobId: backupJob.id,
        scope: backupJob.scope,
        status: backupJob.status,
      },
    });

    return backupJob;
  });
}

export async function createRestoreRequest(
  authContext: AuthContext,
  backupJobId: string,
  input: CreateRestoreRequestInput,
  db: Database = getDb(),
): Promise<RestoreRequestListItem> {
  requireBackupAccess(authContext);

  return db.transaction(async (tx) => {
    const backupJob = await findBackupJobForRestoreById(tx, backupJobId);

    if (!backupJob) {
      throw new BackupsError(
        "BACKUP_JOB_NOT_FOUND",
        "Backup job was not found.",
        404,
      );
    }
    if (backupJob.status !== "succeeded") {
      throw new BackupsError(
        "BACKUP_NOT_READY",
        "Only a verified, succeeded backup can be requested for restore.",
        409,
      );
    }

    return insertRestoreRequest(tx, {
      ...input,
      backupJobId,
      tenantId: backupJob.tenantId,
      actorUserId: authContext.userId,
    });
  });
}

export async function listRestoreRequests(
  authContext: AuthContext,
  input: RestoreRequestListInput,
  db: Database = getDb(),
): Promise<RestoreRequestListItem[]> {
  requireBackupAccess(authContext);

  return findRestoreRequests(db, input);
}

export async function reviewRestoreRequest(
  authContext: AuthContext,
  requestId: string,
  action: ReviewRestoreRequestAction,
  reviewNote?: string,
  requestMeta: RequestMeta = {},
  db: Database = getDb(),
): Promise<RestoreRequestListItem> {
  requireSuperAdmin(authContext);
  const note = reviewNote?.trim();
  if (action === "complete" && !note) {
    throw new BackupsError(
      "RESTORE_COMPLETION_NOTE_REQUIRED",
      "Record the manually verified restore result before marking it completed.",
      400,
    );
  }
  return db.transaction(async (tx) => {
    const current = await findRestoreRequestForReview(tx, requestId);
    if (!current) {
      throw new BackupsError(
        "RESTORE_REQUEST_NOT_FOUND",
        "Restore request was not found.",
        404,
      );
    }
    const allowed =
      current.status === "pending"
        ? ["approve", "reject", "cancel"]
        : current.status === "approved"
          ? ["complete", "cancel"]
          : [];
    if (!allowed.includes(action)) {
      throw new BackupsError(
        "RESTORE_TRANSITION_CONFLICT",
        "Restore request status has changed.",
        409,
      );
    }
    if (action === "approve" && current.backupJobId) {
      const backup = await findBackupJobForRestoreById(tx, current.backupJobId);
      if (!backup || backup.status !== "succeeded") {
        throw new BackupsError(
          "BACKUP_NOT_READY",
          "The backup is no longer available for restore.",
          409,
        );
      }
    }
    const targetStatus = {
      approve: "approved",
      reject: "rejected",
      complete: "completed",
      cancel: "cancelled",
    } as const;
    const updated = await transitionRestoreRequest(tx, {
      id: requestId,
      expectedStatus: current.status,
      status: targetStatus[action],
      actorUserId: authContext.userId,
      reviewNote: note,
    });
    if (!updated) {
      throw new BackupsError(
        "RESTORE_TRANSITION_CONFLICT",
        "Restore request status has changed.",
        409,
      );
    }
    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId: updated.tenantId,
      eventCategory: "saas_backups",
      eventType: `restore_request.${action}`,
      entityType: "restore_request",
      entityId: updated.id,
      reason: note,
      before: { status: current.status },
      after: { status: updated.status },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    await writeOperationLog(tx, {
      tenantId: updated.tenantId,
      level: "info",
      service: "saas-backups",
      eventType: `restore_request.${action}`,
      message:
        action === "complete"
          ? "Manual restore completion was recorded by a SaaS administrator."
          : `Restore request ${action} was recorded.`,
      requestId: requestMeta.requestId,
      actorUserId: authContext.userId,
      metadata: { restoreRequestId: updated.id, status: updated.status },
    });
    return updated;
  });
}
