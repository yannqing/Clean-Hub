import {
  index,
  integer,
  numeric,
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

export const businessLineEnum = pgEnum("business_line", [
  "laundry",
  "car_wash",
  "retail",
  "delivery",
]);

export const pricingUnitEnum = pgEnum("pricing_unit", ["per_item", "per_kg"]);

export const catalogItemStatusEnum = pgEnum("catalog_item_status", [
  "active",
  "inactive",
]);

export const services = pgTable(
  "services",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryId: ulidColumn("category_id"),
    name: varchar("name", { length: 200 }).notNull(),
    businessLine: businessLineEnum("business_line").notNull(),
    pricingUnit: pricingUnitEnum("pricing_unit").notNull().default("per_item"),
    status: catalogItemStatusEnum("status").notNull().default("active"),
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
    index("services_tenant_id_idx").on(table.tenantId),
    index("services_business_line_idx").on(table.businessLine),
    index("services_status_idx").on(table.status),
    index("services_deleted_at_idx").on(table.deletedAt),
  ],
);

export const prices = pgTable(
  "prices",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: ulidColumn("service_id")
      .notNull()
      .references(() => services.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    status: catalogItemStatusEnum("status").notNull().default("active"),
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
    uniqueIndex("prices_service_id_unique").on(table.serviceId),
    index("prices_tenant_id_idx").on(table.tenantId),
    index("prices_status_idx").on(table.status),
    index("prices_deleted_at_idx").on(table.deletedAt),
  ],
);
