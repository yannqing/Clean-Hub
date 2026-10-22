import { createId } from "@cleanhub/id";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import {
  backupJobs,
  restoreRequests,
  tenants,
  type Database,
} from "@cleanhub/db";

import type {
  BackupJobListInput,
  BackupJobListItem,
  CreateBackupJobInput,
  CreateRestoreRequestInput,
  RestoreRequestListInput,
  RestoreRequestListItem,
} from "./backups.types.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function backupTenantExists(
  db: Database,
  tenantId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);
  return Boolean(row);
}

export async function findBackupJobs(
  db: Database,
  input: BackupJobListInput,
): Promise<BackupJobListItem[]> {
  const rows = await db
    .select({
      id: backupJobs.id,
      tenantId: backupJobs.tenantId,
      scope: backupJobs.scope,
      status: backupJobs.status,
      requestedBy: backupJobs.requestedBy,
      startedAt: backupJobs.startedAt,
      finishedAt: backupJobs.finishedAt,
      failureReason: backupJobs.failureReason,
      resultMetadata: backupJobs.resultMetadata,
      createdAt: backupJobs.createdAt,
      updatedAt: backupJobs.updatedAt,
    })
    .from(backupJobs)
    .where(
      and(
        isNull(backupJobs.deletedAt),
        input.scope ? eq(backupJobs.scope, input.scope) : undefined,
        input.status ? eq(backupJobs.status, input.status) : undefined,
        input.tenantId ? eq(backupJobs.tenantId, input.tenantId) : undefined,
      ),
    )
    .orderBy(desc(backupJobs.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    startedAt: toIsoString(row.startedAt),
    finishedAt: toIsoString(row.finishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function insertBackupJob(
  db: Database,
  input: CreateBackupJobInput & { actorUserId: string },
): Promise<BackupJobListItem> {
  const now = new Date();
  const backupJobId = createId();
  const rows = await db
    .insert(backupJobs)
    .values({
      id: backupJobId,
      tenantId: input.tenantId,
      scope: input.scope,
      status: "pending",
      requestedBy: input.actorUserId,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .returning({
      id: backupJobs.id,
      tenantId: backupJobs.tenantId,
      scope: backupJobs.scope,
      status: backupJobs.status,
      requestedBy: backupJobs.requestedBy,
      startedAt: backupJobs.startedAt,
      finishedAt: backupJobs.finishedAt,
      failureReason: backupJobs.failureReason,
      resultMetadata: backupJobs.resultMetadata,
      createdAt: backupJobs.createdAt,
      updatedAt: backupJobs.updatedAt,
    });

  const backupJob = rows[0];

  return {
    ...backupJob,
    startedAt: toIsoString(backupJob.startedAt),
    finishedAt: toIsoString(backupJob.finishedAt),
    createdAt: backupJob.createdAt.toISOString(),
    updatedAt: backupJob.updatedAt.toISOString(),
  };
}

export async function findBackupJobForRestoreById(
  db: Database,
  backupJobId: string,
): Promise<{
  id: string;
  tenantId: string | null;
  scope: string;
  status: string;
} | null> {
  const rows = await db
    .select({
      id: backupJobs.id,
      tenantId: backupJobs.tenantId,
      scope: backupJobs.scope,
      status: backupJobs.status,
    })
    .from(backupJobs)
    .where(and(eq(backupJobs.id, backupJobId), isNull(backupJobs.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

export async function insertRestoreRequest(
  db: Database,
  input: CreateRestoreRequestInput & {
    backupJobId: string;
    tenantId: string | null;
    actorUserId: string;
  },
): Promise<RestoreRequestListItem> {
  const now = new Date();
  const rows = await db
    .insert(restoreRequests)
    .values({
      id: createId(),
      backupJobId: input.backupJobId,
      tenantId: input.tenantId,
      requestedBy: input.actorUserId,
      reason: input.reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .returning({
      id: restoreRequests.id,
      backupJobId: restoreRequests.backupJobId,
      tenantId: restoreRequests.tenantId,
      requestedBy: restoreRequests.requestedBy,
      reason: restoreRequests.reason,
      status: restoreRequests.status,
      reviewedBy: restoreRequests.reviewedBy,
      reviewedAt: restoreRequests.reviewedAt,
      reviewNote: restoreRequests.reviewNote,
      createdAt: restoreRequests.createdAt,
      updatedAt: restoreRequests.updatedAt,
    });

  const restoreRequest = rows[0];

  return {
    ...restoreRequest,
    reviewedAt: toIsoString(restoreRequest.reviewedAt),
    createdAt: restoreRequest.createdAt.toISOString(),
    updatedAt: restoreRequest.updatedAt.toISOString(),
  };
}

export async function findRestoreRequests(
  db: Database,
  input: RestoreRequestListInput,
): Promise<RestoreRequestListItem[]> {
  const rows = await db
    .select({
      id: restoreRequests.id,
      backupJobId: restoreRequests.backupJobId,
      tenantId: restoreRequests.tenantId,
      requestedBy: restoreRequests.requestedBy,
      reason: restoreRequests.reason,
      status: restoreRequests.status,
      reviewedBy: restoreRequests.reviewedBy,
      reviewedAt: restoreRequests.reviewedAt,
      reviewNote: restoreRequests.reviewNote,
      createdAt: restoreRequests.createdAt,
      updatedAt: restoreRequests.updatedAt,
    })
    .from(restoreRequests)
    .where(
      and(
        isNull(restoreRequests.deletedAt),
        input.status ? eq(restoreRequests.status, input.status) : undefined,
        input.tenantId
          ? eq(restoreRequests.tenantId, input.tenantId)
          : undefined,
        input.backupJobId
          ? eq(restoreRequests.backupJobId, input.backupJobId)
          : undefined,
      ),
    )
    .orderBy(desc(restoreRequests.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    reviewedAt: toIsoString(row.reviewedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function findRestoreRequestForReview(
  db: Database,
  requestId: string,
): Promise<RestoreRequestListItem | null> {
  const found = await db
    .select({
      id: restoreRequests.id,
      backupJobId: restoreRequests.backupJobId,
      tenantId: restoreRequests.tenantId,
      requestedBy: restoreRequests.requestedBy,
      reason: restoreRequests.reason,
      status: restoreRequests.status,
      reviewedBy: restoreRequests.reviewedBy,
      reviewedAt: restoreRequests.reviewedAt,
      reviewNote: restoreRequests.reviewNote,
      createdAt: restoreRequests.createdAt,
      updatedAt: restoreRequests.updatedAt,
    })
    .from(restoreRequests)
    .where(
      and(eq(restoreRequests.id, requestId), isNull(restoreRequests.deletedAt)),
    )
    .limit(1);
  const row = found[0];
  return row
    ? {
        ...row,
        reviewedAt: toIsoString(row.reviewedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}

export async function transitionRestoreRequest(
  db: Database,
  input: {
    id: string;
    expectedStatus: RestoreRequestListItem["status"];
    status: RestoreRequestListItem["status"];
    actorUserId: string;
    reviewNote?: string;
  },
): Promise<RestoreRequestListItem | null> {
  const now = new Date();
  const rows = await db
    .update(restoreRequests)
    .set({
      status: input.status,
      reviewedBy: input.actorUserId,
      reviewedAt: now,
      reviewNote: input.reviewNote ?? undefined,
      updatedAt: now,
      updatedBy: input.actorUserId,
      version: sql`${restoreRequests.version} + 1`,
    })
    .where(
      and(
        eq(restoreRequests.id, input.id),
        eq(restoreRequests.status, input.expectedStatus),
        isNull(restoreRequests.deletedAt),
      ),
    )
    .returning({
      id: restoreRequests.id,
      backupJobId: restoreRequests.backupJobId,
      tenantId: restoreRequests.tenantId,
      requestedBy: restoreRequests.requestedBy,
      reason: restoreRequests.reason,
      status: restoreRequests.status,
      reviewedBy: restoreRequests.reviewedBy,
      reviewedAt: restoreRequests.reviewedAt,
      reviewNote: restoreRequests.reviewNote,
      createdAt: restoreRequests.createdAt,
      updatedAt: restoreRequests.updatedAt,
    });
  const row = rows[0];
  return row
    ? {
        ...row,
        reviewedAt: toIsoString(row.reviewedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}
