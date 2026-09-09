import { sql } from "drizzle-orm";
import {
  boolean,
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
import { mediaObjects } from "../platform/media.js";
import { branches } from "../tenancy/branches.js";
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

export type ServiceApplicableItemType = "cloth" | "car" | "shoe" | "carpet";

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
    allBranches: boolean("all_branches").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    labelRule: serviceLabelRuleEnum("label_rule")
      .notNull()
      .default("per_order_item"),
    applicableItemTypes: text("applicable_item_types")
      .array()
      .$type<ServiceApplicableItemType[]>()
      .notNull()
      .default(sql`ARRAY['cloth', 'shoe', 'carpet']::text[]`),
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
    check(
      "services_applicable_item_types_check",
      sql`cardinality(${table.applicableItemTypes}) > 0
        and ${table.applicableItemTypes} <@ ARRAY['cloth', 'car', 'shoe', 'carpet']::text[]
        and (${table.businessLine}::text <> 'car_wash' or ${table.applicableItemTypes} <@ ARRAY['car']::text[])
        and (${table.businessLine}::text <> 'laundry' or not (${table.applicableItemTypes} @> ARRAY['car']::text[]))`,
    ),
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

export const serviceBranchSettings = pgTable(
  "service_branch_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: ulidColumn("service_id").notNull(),
    branchId: ulidColumn("branch_id").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    priceOverrideAmount: numeric("price_override_amount", {
      precision: 12,
      scale: 2,
    }),
    turnaroundMinutesOverride: integer("turnaround_minutes_override"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("service_branch_settings_scope_unique").on(
      table.tenantId,
      table.serviceId,
      table.branchId,
    ),
    foreignKey({
      name: "service_branch_settings_tenant_service_fk",
      columns: [table.tenantId, table.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "service_branch_settings_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("cascade"),
    index("service_branch_settings_branch_available_idx").on(
      table.tenantId,
      table.branchId,
      table.isAvailable,
    ),
    index("service_branch_settings_service_idx").on(
      table.tenantId,
      table.serviceId,
    ),
    check(
      "service_branch_settings_price_override_check",
      sql`${table.priceOverrideAmount} is null or ${table.priceOverrideAmount} > 0`,
    ),
    check(
      "service_branch_settings_turnaround_override_check",
      sql`${table.turnaroundMinutesOverride} is null or (${table.turnaroundMinutesOverride} >= 1 and ${table.turnaroundMinutesOverride} <= 525600)`,
    ),
  ],
);

export const serviceMedia = pgTable(
  "service_media",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: ulidColumn("service_id").notNull(),
    mediaObjectId: ulidColumn("media_object_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("service_media_service_object_unique")
      .on(table.tenantId, table.serviceId, table.mediaObjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("service_media_tenant_object_unique")
      .on(table.tenantId, table.mediaObjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("service_media_service_primary_unique")
      .on(table.tenantId, table.serviceId)
      .where(sql`${table.deletedAt} is null and ${table.isPrimary} = true`),
    foreignKey({
      name: "service_media_tenant_service_fk",
      columns: [table.tenantId, table.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "service_media_tenant_media_object_fk",
      columns: [table.tenantId, table.mediaObjectId],
      foreignColumns: [mediaObjects.tenantId, mediaObjects.id],
    }).onDelete("restrict"),
    index("service_media_media_object_id_idx").on(table.mediaObjectId),
    index("service_media_service_sort_idx").on(
      table.tenantId,
      table.serviceId,
      table.sortOrder,
    ),
    index("service_media_deleted_at_idx").on(table.deletedAt),
  ],
);
