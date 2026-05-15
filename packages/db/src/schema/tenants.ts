import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidPrimaryKey } from "./id.js";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "disabled",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: ulidPrimaryKey(),
    name: text("name").notNull(),
    pressingCode: text("pressing_code").notNull().unique(),
    status: tenantStatusEnum("status").notNull().default("active"),
    country: varchar("country", { length: 80 }),
    city: varchar("city", { length: 120 }),
    contactName: varchar("contact_name", { length: 120 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    contactEmail: varchar("contact_email", { length: 320 }),
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
    index("tenants_status_idx").on(table.status),
    index("tenants_deleted_at_idx").on(table.deletedAt),
  ],
);
