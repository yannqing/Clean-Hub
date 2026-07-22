import { createId } from "@cleanhub/id";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";

import { getDb, mobilePushTokens, type Database } from "@cleanhub/db";

import type { MobilePushPlatform } from "./notifications.types.js";

export type MobilePushTokenRow = typeof mobilePushTokens.$inferSelect;

export class MobileNotificationsRepository {
  constructor(private readonly db: Database = getDb()) {}

  /**
   * Upserts a device token by its unique token value. A token that already
   * exists (even soft deleted, or bound to another subject after an account
   * switch on the same device) is rebound to the current subject and revived.
   */
  async upsertDeviceToken(input: {
    tenantId: string;
    subjectType: "customer" | "staff";
    subjectId: string;
    token: string;
    platform: MobilePushPlatform;
    deviceId: string | null;
    locale: string | null;
    now: Date;
  }): Promise<MobilePushTokenRow> {
    const [row] = await this.db
      .insert(mobilePushTokens)
      .values({
        id: createId(),
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        platform: input.platform,
        token: input.token,
        deviceId: input.deviceId,
        locale: input.locale,
        lastSeenAt: input.now,
      })
      .onConflictDoUpdate({
        target: mobilePushTokens.token,
        set: {
          tenantId: input.tenantId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          platform: input.platform,
          deviceId: input.deviceId,
          locale: input.locale,
          lastSeenAt: input.now,
          updatedAt: input.now,
          deletedAt: null,
        },
      })
      .returning({ ...getTableColumns(mobilePushTokens) });

    if (!row) {
      throw new Error("Device token upsert failed.");
    }

    return row;
  }

  /**
   * Soft deletes a token owned by the given subject. Returns false when the
   * token does not exist or belongs to someone else (no-op).
   */
  async softDeleteDeviceToken(input: {
    tenantId: string;
    subjectType: "customer" | "staff";
    subjectId: string;
    token: string;
    now: Date;
  }): Promise<boolean> {
    const rows = await this.db
      .update(mobilePushTokens)
      .set({
        deletedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(mobilePushTokens.token, input.token),
          eq(mobilePushTokens.tenantId, input.tenantId),
          eq(mobilePushTokens.subjectType, input.subjectType),
          eq(mobilePushTokens.subjectId, input.subjectId),
          isNull(mobilePushTokens.deletedAt),
        ),
      )
      .returning({ id: mobilePushTokens.id });

    return rows.length > 0;
  }
}
