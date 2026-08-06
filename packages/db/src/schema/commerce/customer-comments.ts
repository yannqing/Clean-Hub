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
import { tenants } from "../tenancy/tenants.js";
import { customers } from "./customer.js";

/** Staff-only collaboration comments shown in a customer's timeline. */
export const customerComments = pgTable(
  "customer_comments",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
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
    uniqueIndex("customer_comments_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("customer_comments_tenant_customer_idempotency_unique").on(
      table.tenantId,
      table.customerId,
      table.idempotencyKey,
    ),
    index("customer_comments_tenant_customer_created_at_idx").on(
      table.tenantId,
      table.customerId,
      table.createdAt,
      table.id,
    ),
    index("customer_comments_author_user_id_idx").on(table.authorUserId),
    index("customer_comments_deleted_at_idx").on(table.deletedAt),
    check(
      "customer_comments_body_length_check",
      sql`char_length(btrim(${table.body})) between 1 and 2000`,
    ),
  ],
);

export const customerCommentMentions = pgTable(
  "customer_comment_mentions",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    commentId: ulidColumn("comment_id")
      .notNull()
      .references(() => customerComments.id, { onDelete: "cascade" }),
    mentionedUserId: ulidColumn("mentioned_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_comment_mentions_comment_user_unique").on(
      table.commentId,
      table.mentionedUserId,
    ),
    index("customer_comment_mentions_tenant_user_idx").on(
      table.tenantId,
      table.mentionedUserId,
      table.createdAt,
    ),
    index("customer_comment_mentions_comment_id_idx").on(table.commentId),
  ],
);

/** Images uploaded alongside an internal customer comment. */
export const customerCommentAttachments = pgTable(
  "customer_comment_attachments",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    commentId: ulidColumn("comment_id")
      .notNull()
      .references(() => customerComments.id, { onDelete: "cascade" }),
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
    uniqueIndex("customer_comment_attachments_comment_media_unique").on(
      table.commentId,
      table.mediaObjectId,
    ),
    uniqueIndex("customer_comment_attachments_tenant_media_unique").on(
      table.tenantId,
      table.mediaObjectId,
    ),
    index("customer_comment_attachments_comment_id_idx").on(table.commentId),
  ],
);
