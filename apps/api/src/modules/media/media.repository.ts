import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lt,
  or,
} from "drizzle-orm";

import { getDb, mediaObjects, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type {
  ClaimedMediaObjectRecord,
  MediaObjectRecord,
} from "./media.types.js";

function toRecord(row: typeof mediaObjects.$inferSelect): MediaObjectRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    objectKey: row.objectKey,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    purpose: row.purpose,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    committedAt: row.committedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    cleanupClaimToken: row.cleanupClaimToken,
    cleanupClaimedAt: row.cleanupClaimedAt?.toISOString() ?? null,
  };
}

function toClaimedRecord(
  row: typeof mediaObjects.$inferSelect,
): ClaimedMediaObjectRecord {
  const record = toRecord(row);

  if (
    record.status !== "deleting" ||
    !record.cleanupClaimToken ||
    !record.cleanupClaimedAt
  ) {
    throw new Error("Claimed media object has invalid cleanup claim state.");
  }

  return {
    ...record,
    status: "deleting",
    cleanupClaimToken: record.cleanupClaimToken,
    cleanupClaimedAt: record.cleanupClaimedAt,
  };
}

export class MediaRepository {
  constructor(private readonly db: Database = getDb()) {}

  async createPending(input: {
    tenantId: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    purpose: string;
    createdBy: string;
    expiresAt: Date;
  }): Promise<MediaObjectRecord> {
    const [row] = await this.db
      .insert(mediaObjects)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        objectKey: input.objectKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        purpose: input.purpose,
        createdBy: input.createdBy,
        expiresAt: input.expiresAt,
      })
      .returning({ ...getTableColumns(mediaObjects) });

    if (!row) {
      throw new Error("Media object insert failed.");
    }

    return toRecord(row);
  }

  async findByObjectKey(input: {
    tenantId: string;
    objectKey: string;
  }): Promise<MediaObjectRecord | null> {
    const [row] = await this.db
      .select({ ...getTableColumns(mediaObjects) })
      .from(mediaObjects)
      .where(
        and(
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async markCommitted(input: {
    tenantId: string;
    objectKey: string;
  }): Promise<MediaObjectRecord | null> {
    const [row] = await this.db
      .update(mediaObjects)
      .set({
        status: "committed",
        committedAt: new Date(),
        cleanupClaimToken: null,
        cleanupClaimedAt: null,
      })
      .where(
        and(
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          eq(mediaObjects.status, "pending"),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(mediaObjects) });

    return row ? toRecord(row) : null;
  }

  async claimExpiredPending(input: {
    now: Date;
    staleClaimedBefore: Date;
    limit: number;
    claimToken: string;
  }): Promise<ClaimedMediaObjectRecord[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: mediaObjects.id })
        .from(mediaObjects)
        .where(
          and(
            or(
              and(
                eq(mediaObjects.status, "pending"),
                lt(mediaObjects.expiresAt, input.now),
              ),
              and(
                eq(mediaObjects.status, "deleting"),
                lt(mediaObjects.cleanupClaimedAt, input.staleClaimedBefore),
              ),
            ),
            isNull(mediaObjects.deletedAt),
          ),
        )
        .orderBy(asc(mediaObjects.expiresAt), asc(mediaObjects.id))
        .limit(input.limit)
        .for("update", { skipLocked: true });

      if (rows.length === 0) {
        return [];
      }

      const claimedRows = /* tenant-scope: system cleanup lease */ await tx
        .update(mediaObjects)
        .set({
          status: "deleting",
          cleanupClaimToken: input.claimToken,
          cleanupClaimedAt: input.now,
        })
        .where(
          and(
            inArray(
              mediaObjects.id,
              rows.map((row) => row.id),
            ),
            isNull(mediaObjects.deletedAt),
          ),
        )
        .returning({ ...getTableColumns(mediaObjects) });

      return claimedRows.map(toClaimedRecord);
    });
  }

  async completeCleanup(input: {
    id: string;
    tenantId: string;
    objectKey: string;
    claimToken: string;
    claimedAt: Date;
    deletedBy?: string;
  }): Promise<boolean> {
    const rows = await this.db
      .update(mediaObjects)
      .set({
        deletedAt: new Date(),
        deletedBy: input.deletedBy,
      })
      .where(
        and(
          eq(mediaObjects.id, input.id),
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          eq(mediaObjects.status, "deleting"),
          eq(mediaObjects.cleanupClaimToken, input.claimToken),
          eq(mediaObjects.cleanupClaimedAt, input.claimedAt),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .returning({ id: mediaObjects.id });

    return rows.length > 0;
  }

  async releaseCleanup(input: {
    id: string;
    tenantId: string;
    objectKey: string;
    claimToken: string;
    claimedAt: Date;
  }): Promise<boolean> {
    const rows = await this.db
      .update(mediaObjects)
      .set({
        status: "pending",
        cleanupClaimToken: null,
        cleanupClaimedAt: null,
      })
      .where(
        and(
          eq(mediaObjects.id, input.id),
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          eq(mediaObjects.status, "deleting"),
          eq(mediaObjects.cleanupClaimToken, input.claimToken),
          eq(mediaObjects.cleanupClaimedAt, input.claimedAt),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .returning({ id: mediaObjects.id });

    return rows.length > 0;
  }
}
