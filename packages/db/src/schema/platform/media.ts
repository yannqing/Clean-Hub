import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";

export const mediaObjectStatusEnum = pgEnum("media_object_status", [
  "pending",
  "committed",
  "deleting",
]);

export const mediaObjects = pgTable(
  "media_objects",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    objectKey: text("object_key").notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: mediaObjectStatusEnum("status").notNull().default("pending"),
    purpose: varchar("purpose", { length: 80 }).notNull(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    cleanupClaimToken: varchar("cleanup_claim_token", { length: 26 }),
    cleanupClaimedAt: timestamp("cleanup_claimed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("media_objects_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("media_objects_object_key_unique").on(table.objectKey),
    index("media_objects_tenant_id_idx").on(table.tenantId),
    index("media_objects_tenant_object_key_idx").on(
      table.tenantId,
      table.objectKey,
    ),
    index("media_objects_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    index("media_objects_cleanup_claim_idx").on(
      table.status,
      table.cleanupClaimedAt,
    ),
    index("media_objects_deleted_at_idx").on(table.deletedAt),
    check(
      "media_objects_cleanup_claim_pair_check",
      sql`(
        ${table.status} = 'deleting'
        and ${table.cleanupClaimToken} is not null
        and ${table.cleanupClaimedAt} is not null
      ) or (
        ${table.status} <> 'deleting'
        and ${table.cleanupClaimToken} is null
        and ${table.cleanupClaimedAt} is null
      )`,
    ),
  ],
);
