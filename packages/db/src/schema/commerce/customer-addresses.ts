import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";
import { customerAccounts } from "./customer-accounts.js";
import { customers } from "./customer.js";

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    customerId: ulidColumn("customer_id").references(() => customers.id),
    label: varchar("label", { length: 80 }).notNull(),
    contactName: varchar("contact_name", { length: 200 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: varchar("city", { length: 120 }),
    province: varchar("province", { length: 120 }),
    postalCode: varchar("postal_code", { length: 32 }),
    country: varchar("country", { length: 2 }).notNull().default("TH"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").notNull().default(false),
    notes: text("notes"),
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
    index("customer_addresses_tenant_account_idx").on(
      table.tenantId,
      table.customerAccountId,
    ),
    index("customer_addresses_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
    index("customer_addresses_tenant_default_idx").on(
      table.tenantId,
      table.customerAccountId,
      table.isDefault,
      table.deletedAt,
    ),
    index("customer_addresses_deleted_at_idx").on(table.deletedAt),
  ],
);
