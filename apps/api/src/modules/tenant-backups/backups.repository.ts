import { createId } from "@cleanhub/id";
import { and, desc, eq, isNull } from "drizzle-orm";

import {
  backupJobs,
  restoreRequests,
  tenantFeatureFlags,
  tenants,
  type Database,
} from "@cleanhub/db";

import type {
  BackupJobListInput,
  BackupJobListItem,
  CreateRestoreRequestInput,
  RestoreRequestListItem,
} from "./backups.types.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function findTenantBackupAccessById(
  db: Database,
  tenantId: string,
): Promise<{ status: "active" | "suspended" | "disabled"; hasFeatureFlags: boolean } | null> {
  const rows = await db
    .select({
      status: tenants.status,
      featureFlagsTenantId: tenantFeatureFlags.tenantId,
    })
    .from(tenants)
    .leftJoin(tenantFeatureFlags, eq(tenantFeatureFlags.tenantId, tenants.id))
    .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)))
    .limit(1);

  const row = rows[0];

  return row
    ? {
        status: row.status,
        hasFeatureFlags: Boolean(row.featureFlagsTenantId),
      }
    : null;
}

export async function findTenantBackupJobs(
  db: Database,
  input: BackupJobListInput & { tenantId: string },
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
      createdAt: backupJobs.createdAt,
      updatedAt: backupJobs.updatedAt,
    })
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.tenantId, input.tenantId),
        eq(backupJobs.scope, "tenant"),
        isNull(backupJobs.deletedAt),
        input.status ? eq(backupJobs.status, input.status) : undefined,
      ),
    )
    .orderBy(desc(backupJobs.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  return rows.map((row) => ({
    ...row,
    tenantId: row.tenantId ?? input.tenantId,
    scope: "tenant",
    startedAt: toIsoString(row.startedAt),
    finishedAt: toIsoString(row.finishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function insertTenantBackupJob(
  db: Database,
  input: { tenantId: string; actorUserId: string },
): Promise<BackupJobListItem> {
  const now = new Date();
  const rows = await db
    .insert(backupJobs)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      scope: "tenant",
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
      createdAt: backupJobs.createdAt,
      updatedAt: backupJobs.updatedAt,
    });

  const backupJob = rows[0];

  return {
    ...backupJob,
    tenantId: backupJob.tenantId ?? input.tenantId,
    scope: "tenant",
    startedAt: toIsoString(backupJob.startedAt),
    finishedAt: toIsoString(backupJob.finishedAt),
    createdAt: backupJob.createdAt.toISOString(),
    updatedAt: backupJob.updatedAt.toISOString(),
  };
}

export async function findTenantBackupJobForRestoreById(
  db: Database,
  input: { tenantId: string; backupJobId: string },
): Promise<{ id: string; tenantId: string | null; scope: string } | null> {
  const rows = await db
    .select({
      id: backupJobs.id,
      tenantId: backupJobs.tenantId,
      scope: backupJobs.scope,
    })
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.id, input.backupJobId),
        eq(backupJobs.tenantId, input.tenantId),
        eq(backupJobs.scope, "tenant"),
        isNull(backupJobs.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function insertTenantRestoreRequest(
  db: Database,
  input: CreateRestoreRequestInput & {
    backupJobId: string;
    tenantId: string;
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
    tenantId: restoreRequest.tenantId ?? input.tenantId,
    reviewedAt: toIsoString(restoreRequest.reviewedAt),
    createdAt: restoreRequest.createdAt.toISOString(),
    updatedAt: restoreRequest.updatedAt.toISOString(),
  };
}
