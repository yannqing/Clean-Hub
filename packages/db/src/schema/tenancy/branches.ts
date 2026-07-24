import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "./tenants.js";

export const branchStatusEnum = pgEnum("branch_status", ["active", "inactive"]);

export const branches = pgTable(
  "branches",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 32 }),
    businessHours: jsonb("business_hours").$type<Record<string, unknown>>(),
    defaultLanguage: varchar("default_language", { length: 16 })
      .notNull()
      .default("en"),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("XOF"),
    receiptName: varchar("receipt_name", { length: 200 }),
    receiptPhone: varchar("receipt_phone", { length: 32 }),
    receiptAddress: text("receipt_address"),
    logoUrl: text("logo_url"),
    status: branchStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("branches_tenant_id_id_unique").on(table.tenantId, table.id),
    index("branches_tenant_id_idx").on(table.tenantId),
    index("branches_status_idx").on(table.status),
    index("branches_deleted_at_idx").on(table.deletedAt),
  ],
);

export const userBranches = pgTable(
  "user_branches",
  {
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.branchId],
      name: "user_branches_pk",
    }),
    index("user_branches_tenant_id_idx").on(table.tenantId),
    index("user_branches_branch_id_idx").on(table.branchId),
  ],
);
