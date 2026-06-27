import {
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
  },
  (table) => [
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
    index("media_objects_deleted_at_idx").on(table.deletedAt),
  ],
);
