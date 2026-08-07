import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
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

export const serviceLabelRuleEnum = pgEnum("service_label_rule", [
  "none",
  "per_item",
  "per_order_item",
  "per_bag",
]);

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 120 }).notNull(),
    businessLine: businessLineEnum("business_line").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
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
    uniqueIndex("service_categories_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("service_categories_tenant_line_id_unique").on(
      table.tenantId,
      table.businessLine,
      table.id,
    ),
    uniqueIndex("service_categories_active_name_unique")
      .on(table.tenantId, table.businessLine, table.name)
      .where(sql`${table.deletedAt} is null`),
    index("service_categories_tenant_line_status_idx").on(
      table.tenantId,
      table.businessLine,
      table.status,
    ),
    index("service_categories_deleted_at_idx").on(table.deletedAt),
    check(
      "service_categories_name_not_blank_check",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check("service_categories_sort_order_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryId: ulidColumn("category_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 64 }),
    shortName: varchar("short_name", { length: 80 }),
    description: text("description"),
    internalNotes: text("internal_notes"),
    businessLine: businessLineEnum("business_line").notNull(),
    pricingUnit: pricingUnitEnum("pricing_unit").notNull().default("per_item"),
    turnaroundMinutes: integer("turnaround_minutes"),
    displayOrder: integer("display_order").notNull().default(0),
    labelRule: serviceLabelRuleEnum("label_rule")
      .notNull()
      .default("per_order_item"),
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
    uniqueIndex("services_tenant_id_id_unique").on(table.tenantId, table.id),
    uniqueIndex("services_active_code_unique")
      .on(table.tenantId, table.code)
      .where(sql`${table.deletedAt} is null and ${table.code} is not null`),
    foreignKey({
      name: "services_tenant_line_category_fk",
      columns: [table.tenantId, table.businessLine, table.categoryId],
      foreignColumns: [
        serviceCategories.tenantId,
        serviceCategories.businessLine,
        serviceCategories.id,
      ],
    }).onDelete("restrict"),
    index("services_tenant_line_status_idx").on(
      table.tenantId,
      table.businessLine,
      table.status,
    ),
    index("services_tenant_category_idx").on(table.tenantId, table.categoryId),
    index("services_tenant_display_order_idx").on(
      table.tenantId,
      table.displayOrder,
    ),
    index("services_deleted_at_idx").on(table.deletedAt),
    check(
      "services_name_not_blank_check",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      "services_code_not_blank_check",
      sql`${table.code} is null or length(btrim(${table.code})) > 0`,
    ),
    check(
      "services_turnaround_minutes_check",
      sql`${table.turnaroundMinutes} is null or (${table.turnaroundMinutes} >= 1 and ${table.turnaroundMinutes} <= 525600)`,
    ),
    check("services_display_order_check", sql`${table.displayOrder} >= 0`),
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
    compareAtAmount: numeric("compare_at_amount", { precision: 12, scale: 2 }),
    costAmount: numeric("cost_amount", { precision: 12, scale: 2 }),
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
    check(
      "prices_compare_at_amount_check",
      sql`${table.compareAtAmount} is null or ${table.compareAtAmount} > 0`,
    ),
    check(
      "prices_cost_amount_check",
      sql`${table.costAmount} is null or ${table.costAmount} > 0`,
    ),
  ],
);
