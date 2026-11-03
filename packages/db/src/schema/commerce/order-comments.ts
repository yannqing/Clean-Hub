import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { mediaObjects } from "../platform/media.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { orders } from "./orders.js";

/**
 * Staff-only collaboration comments shown in an order's activity timeline.
 * System events continue to come from audit logs so business history is not
 * duplicated across two append-only stores.
 */
export const orderComments = pgTable(
  "order_comments",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorUserId: ulidColumn("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("order_comments_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("order_comments_tenant_order_idempotency_unique").on(
      table.tenantId,
      table.orderId,
      table.idempotencyKey,
    ),
    index("order_comments_tenant_order_created_at_idx").on(
      table.tenantId,
      table.orderId,
      table.createdAt,
      table.id,
    ),
    index("order_comments_author_user_id_idx").on(table.authorUserId),
    index("order_comments_deleted_at_idx").on(table.deletedAt),
    check(
      "order_comments_body_length_check",
      sql`char_length(btrim(${table.body})) between 1 and 2000`,
    ),
  ],
);

/**
 * Explicit staff mentions attached to an order comment. Keeping mentions in a
 * join table makes edits deterministic and lets notification delivery remain
 * idempotent without parsing free-form comment text.
 */
export const orderCommentMentions = pgTable(
  "order_comment_mentions",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    commentId: ulidColumn("comment_id")
      .notNull()
      .references(() => orderComments.id, { onDelete: "cascade" }),
    mentionedUserId: ulidColumn("mentioned_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("order_comment_mentions_comment_user_unique").on(
      table.commentId,
      table.mentionedUserId,
    ),
    index("order_comment_mentions_tenant_user_idx").on(
      table.tenantId,
      table.mentionedUserId,
      table.createdAt,
    ),
    index("order_comment_mentions_comment_id_idx").on(table.commentId),
  ],
);

/** Images uploaded alongside an internal order comment. */
export const orderCommentAttachments = pgTable(
  "order_comment_attachments",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    commentId: ulidColumn("comment_id")
      .notNull()
      .references(() => orderComments.id, { onDelete: "cascade" }),
    mediaObjectId: ulidColumn("media_object_id")
      .notNull()
      .references(() => mediaObjects.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("order_comment_attachments_comment_media_unique").on(
      table.commentId,
      table.mediaObjectId,
    ),
    uniqueIndex("order_comment_attachments_tenant_media_unique").on(
      table.tenantId,
      table.mediaObjectId,
    ),
    index("order_comment_attachments_comment_id_idx").on(table.commentId),
  ],
);
