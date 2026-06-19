import { getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import {
  assertActiveTenant,
  assertTenantContext,
  requireTenantRole,
} from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { TenantBackupsError } from "./backups.errors.js";
import {
  findTenantBackupAccessById,
  findTenantBackupJobForRestoreById,
  findTenantBackupJobs,
  insertTenantBackupJob,
  insertTenantRestoreRequest,
} from "./backups.repository.js";
import type {
  BackupJobListInput,
  BackupJobListItem,
  CreateBackupJobInput,
  CreateRestoreRequestInput,
  RestoreRequestListItem,
} from "./backups.types.js";

function getTenantId(authContext: AuthContext): string {
  assertTenantContext(authContext);

  if (!authContext.tenantId) {
    throw new TenantBackupsError(
      "TENANT_CONTEXT_REQUIRED",
      "Tenant context is required for backup APIs.",
      403,
    );
  }

  return authContext.tenantId;
}

async function requireTenantBackupAccess(
  db: Database,
  tenantId: string,
): Promise<void> {
  const access = await findTenantBackupAccessById(db, tenantId);

  if (!access || access.status !== "active") {
    throw new TenantBackupsError("TENANT_NOT_ACTIVE", "Tenant is not active.", 403);
  }

  if (!access.hasFeatureFlags) {
    throw new TenantBackupsError(
      "FEATURE_DISABLED",
      "Tenant feature flags are not configured.",
      403,
    );
  }
}

export async function listTenantBackupJobs(
  authContext: AuthContext,
  input: BackupJobListInput,
  db: Database = getDb(),
): Promise<BackupJobListItem[]> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner", "manager"]);
  await assertActiveTenant(authContext, db);
  await requireTenantBackupAccess(db, tenantId);

  return findTenantBackupJobs(db, {
    ...input,
    tenantId,
  });
}

export async function createTenantBackupJob(
  authContext: AuthContext,
  input: CreateBackupJobInput,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<BackupJobListItem> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner"]);
  await assertActiveTenant(authContext, db);
  await requireTenantBackupAccess(db, tenantId);

  return db.transaction(async (tx) => {
    const backupJob = await insertTenantBackupJob(tx, {
      tenantId,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_backup",
      eventType: "backup_job.created",
      entityType: "backup_job",
      entityId: backupJob.id,
      reason: input.reason,
      after: {
        scope: backupJob.scope,
        status: backupJob.status,
        tenantId,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return backupJob;
  });
}

export async function createTenantRestoreRequest(
  authContext: AuthContext,
  backupJobId: string,
  input: CreateRestoreRequestInput,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<RestoreRequestListItem> {
  const tenantId = getTenantId(authContext);

  requireTenantRole(authContext, ["owner"]);
  await assertActiveTenant(authContext, db);
  await requireTenantBackupAccess(db, tenantId);

  return db.transaction(async (tx) => {
    const backupJob = await findTenantBackupJobForRestoreById(tx, {
      tenantId,
      backupJobId,
    });

    if (!backupJob) {
      throw new TenantBackupsError(
        "BACKUP_JOB_NOT_FOUND",
        "Backup job was not found.",
        404,
      );
    }

    const restoreRequest = await insertTenantRestoreRequest(tx, {
      ...input,
      backupJobId,
      tenantId,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      eventCategory: "tenant_backup",
      eventType: "restore_request.created",
      entityType: "restore_request",
      entityId: restoreRequest.id,
      reason: input.reason,
      after: {
        backupJobId,
        status: restoreRequest.status,
        tenantId,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return restoreRequest;
  });
}
