import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";
import { customerAccounts } from "./customer-accounts.js";

export const customerProfileStatusEnum = pgEnum("customer_profile_status", [
  "active",
  "disabled",
]);

export const customers = pgTable(
  "customers",
  {
    id: ulidPrimaryKey(),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: ulidColumn("user_id").references(() => users.id),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    relationship: varchar("relationship", { length: 80 }),
    address: text("address"),
    notes: text("notes"),
    status: customerProfileStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("customers_tenant_account_idx").on(
      table.tenantId,
      table.customerAccountId,
    ),
    index("customers_tenant_phone_idx").on(table.tenantId, table.phone),
    index("customers_tenant_status_idx").on(table.tenantId, table.status),
    index("customers_tenant_id_deleted_at_idx").on(
      table.tenantId,
      table.deletedAt,
    ),
  ],
);
