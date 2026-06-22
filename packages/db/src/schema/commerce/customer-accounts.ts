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

export const customerAccountStatusEnum = pgEnum("customer_account_status", [
  "active",
  "disabled",
]);

export const customerAccounts = pgTable(
  "customer_accounts",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountName: varchar("account_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 320 }),
    status: customerAccountStatusEnum("status").notNull().default("active"),
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
    uniqueIndex("customer_accounts_tenant_phone_unique").on(
      table.tenantId,
      table.phone,
    ),
    uniqueIndex("customer_accounts_tenant_email_unique").on(
      table.tenantId,
      table.email,
    ),
    index("customer_accounts_tenant_id_idx").on(table.tenantId),
    index("customer_accounts_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
    index("customer_accounts_deleted_at_idx").on(table.deletedAt),
  ],
);
