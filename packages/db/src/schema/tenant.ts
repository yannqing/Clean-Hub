import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "./id.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const branchStatusEnum = pgEnum("branch_status", ["active", "inactive"]);

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

export const hardwareDeviceTypeEnum = pgEnum("hardware_device_type", [
  "printer",
  "scanner",
  "cash_drawer",
]);

export const hardwareConnectionTypeEnum = pgEnum("hardware_connection_type", [
  "usb",
  "bluetooth",
  "network",
  "other",
]);

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
    index("branches_tenant_id_idx").on(table.tenantId),
    index("branches_status_idx").on(table.status),
    index("branches_deleted_at_idx").on(table.deletedAt),
  ],
);

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

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    settings: jsonb("settings")
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
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
    uniqueIndex("notification_settings_tenant_id_unique").on(table.tenantId),
  ],
);

export const hardwareConfigs = pgTable(
  "hardware_configs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    deviceType: hardwareDeviceTypeEnum("device_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    connectionType: hardwareConnectionTypeEnum("connection_type").notNull(),
    config: jsonb("config")
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
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
    index("hardware_configs_tenant_id_idx").on(table.tenantId),
    index("hardware_configs_branch_id_idx").on(table.branchId),
    index("hardware_configs_status_idx").on(table.status),
    index("hardware_configs_deleted_at_idx").on(table.deletedAt),
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
