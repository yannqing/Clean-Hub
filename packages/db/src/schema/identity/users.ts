import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { tenants } from "../tenancy/tenants.js";

export const userTypeEnum = pgEnum("user_type", ["saas", "tenant"]);
export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "disabled",
  "suspended",
]);

export const users = pgTable(
  "users",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    userType: userTypeEnum("user_type").notNull(),
    email: varchar("email", { length: 320 }),
    normalizedEmail: varchar("normalized_email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    passwordHash: text("password_hash").notNull(),
    pinHash: text("pin_hash").notNull(),
    status: userStatusEnum("status").notNull().default("invited"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("users_tenant_normalized_email_unique").on(
      table.tenantId,
      table.normalizedEmail,
    ),
    index("users_tenant_id_idx").on(table.tenantId),
    index("users_status_idx").on(table.status),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: ulidColumn("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  firstName: varchar("first_name", { length: 80 }),
  lastName: varchar("last_name", { length: 80 }),
  avatarUrl: text("avatar_url"),
  language: varchar("language", { length: 16 }).notNull().default("en"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
