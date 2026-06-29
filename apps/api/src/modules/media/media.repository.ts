import { and, eq, getTableColumns, isNull, lt } from "drizzle-orm";

import { getDb, mediaObjects, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { MediaObjectRecord } from "./media.types.js";

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
      })
      .where(
        and(
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .returning({ ...getTableColumns(mediaObjects) });

    return row ? toRecord(row) : null;
  }

  async listExpiredPending(input: {
    now: Date;
    limit: number;
  }): Promise<MediaObjectRecord[]> {
    const rows = await this.db
      .select({ ...getTableColumns(mediaObjects) })
      .from(mediaObjects)
      .where(
        and(
          eq(mediaObjects.status, "pending"),
          lt(mediaObjects.expiresAt, input.now),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .limit(input.limit);

    return rows.map(toRecord);
  }

  async softDelete(input: {
    tenantId: string;
    objectKey: string;
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
          eq(mediaObjects.tenantId, input.tenantId),
          eq(mediaObjects.objectKey, input.objectKey),
          isNull(mediaObjects.deletedAt),
        ),
      )
      .returning({ id: mediaObjects.id });

    return rows.length > 0;
  }
}
