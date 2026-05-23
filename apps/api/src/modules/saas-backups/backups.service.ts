import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext } from "../auth/auth.types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { writeAuditLog } from "../audit/audit.helper.js";
import { writeOperationLog } from "../saas-ops/operation-logs.helper.js";
import { BackupsError } from "./backups.errors.js";
import {
  findBackupJobForRestoreById,
  findBackupJobs,
  findRestoreRequests,
  insertBackupJob,
  insertRestoreRequest,
} from "./backups.repository.js";
import type {
  BackupJobListInput,
  BackupJobListItem,
  CreateBackupJobInput,
  CreateRestoreRequestInput,
  RestoreRequestListInput,
  RestoreRequestListItem,
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
      message: "Backup job was queued for manual processing.",
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
