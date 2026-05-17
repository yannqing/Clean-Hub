import { and, desc, eq, isNull } from "drizzle-orm";

import { backupJobs, type Database } from "@cleanhub/db";

import type {
  BackupJobListInput,
  BackupJobListItem,
} from "./backups.types.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
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
