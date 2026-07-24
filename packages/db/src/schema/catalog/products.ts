import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
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
import { catalogItemStatusEnum } from "./services.js";

export const productCategories = pgTable(
  "product_categories",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    parentId: ulidColumn("parent_id"),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 80 }),
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
    uniqueIndex("product_categories_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("product_categories_tenant_code_unique")
      .on(table.tenantId, table.code)
      .where(sql`${table.deletedAt} is null and ${table.code} is not null`),
    foreignKey({
      name: "product_categories_tenant_parent_fk",
      columns: [table.tenantId, table.parentId],
      foreignColumns: [table.tenantId, table.id],
    }).onDelete("restrict"),
    index("product_categories_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
    index("product_categories_parent_id_idx").on(table.parentId),
    index("product_categories_deleted_at_idx").on(table.deletedAt),
    check(
      "product_categories_parent_not_self_check",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryId: ulidColumn("category_id"),
    name: varchar("name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    description: text("description"),
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
    uniqueIndex("products_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      name: "products_tenant_category_fk",
      columns: [table.tenantId, table.categoryId],
      foreignColumns: [productCategories.tenantId, productCategories.id],
    }).onDelete("restrict"),
    index("products_tenant_status_idx").on(table.tenantId, table.status),
    index("products_tenant_name_idx").on(table.tenantId, table.name),
    index("products_category_id_idx").on(table.categoryId),
    index("products_deleted_at_idx").on(table.deletedAt),
  ],
);

export const productSkus = pgTable(
  "product_skus",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productId: ulidColumn("product_id").notNull(),
    skuCode: varchar("sku_code", { length: 80 }).notNull(),
    barcode: varchar("barcode", { length: 80 }),
    variantName: varchar("variant_name", { length: 160 }),
    attributes: jsonb("attributes")
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    unitOfMeasure: varchar("unit_of_measure", { length: 32 })
      .notNull()
      .default("piece"),
    unitsPerSale: numeric("units_per_sale", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("1"),
    trackInventory: boolean("track_inventory").notNull().default(true),
    referenceCostAmount: numeric("reference_cost_amount", {
      precision: 12,
      scale: 2,
    }),
    costCurrency: varchar("cost_currency", { length: 3 }),
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
    uniqueIndex("product_skus_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("product_skus_tenant_product_id_id_unique").on(
      table.tenantId,
      table.productId,
      table.id,
    ),
    uniqueIndex("product_skus_tenant_sku_code_unique")
      .on(table.tenantId, table.skuCode)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("product_skus_tenant_barcode_unique")
      .on(table.tenantId, table.barcode)
      .where(sql`${table.deletedAt} is null and ${table.barcode} is not null`),
    foreignKey({
      name: "product_skus_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("restrict"),
    index("product_skus_tenant_status_idx").on(table.tenantId, table.status),
    index("product_skus_product_id_idx").on(table.productId),
    index("product_skus_deleted_at_idx").on(table.deletedAt),
    check(
      "product_skus_units_per_sale_positive_check",
      sql`${table.unitsPerSale} > 0`,
    ),
    check(
      "product_skus_reference_cost_check",
      sql`(${table.referenceCostAmount} is null and ${table.costCurrency} is null)
        or (${table.referenceCostAmount} >= 0 and ${table.costCurrency} is not null)`,
    ),
  ],
);

export const productPrices = pgTable(
  "product_prices",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
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
    uniqueIndex("product_prices_tenant_sku_id_id_unique").on(
      table.tenantId,
      table.productSkuId,
      table.id,
    ),
    uniqueIndex("product_prices_tenant_default_unique")
      .on(table.tenantId, table.productSkuId, table.currency)
      .where(sql`${table.branchId} is null and ${table.deletedAt} is null`),
    uniqueIndex("product_prices_branch_unique")
      .on(table.tenantId, table.branchId, table.productSkuId, table.currency)
      .where(sql`${table.branchId} is not null and ${table.deletedAt} is null`),
    foreignKey({
      name: "product_prices_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "product_prices_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    index("product_prices_tenant_status_idx").on(table.tenantId, table.status),
    index("product_prices_product_sku_id_idx").on(table.productSkuId),
    index("product_prices_deleted_at_idx").on(table.deletedAt),
    check("product_prices_amount_nonnegative_check", sql`${table.amount} >= 0`),
  ],
);

export const branchProductSettings = pgTable(
  "branch_product_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id").notNull(),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    allowNegativeStock: boolean("allow_negative_stock")
      .notNull()
      .default(false),
    allowOfflineSale: boolean("allow_offline_sale").notNull().default(false),
    reorderPoint: numeric("reorder_point", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("0"),
    offlineStockBuffer: numeric("offline_stock_buffer", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("0"),
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
    uniqueIndex("branch_product_settings_scope_unique").on(
      table.tenantId,
      table.branchId,
      table.productSkuId,
    ),
    foreignKey({
      name: "branch_product_settings_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "branch_product_settings_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    index("branch_product_settings_branch_available_idx").on(
      table.tenantId,
      table.branchId,
      table.isAvailable,
    ),
    index("branch_product_settings_product_sku_id_idx").on(table.productSkuId),
    check(
      "branch_product_settings_reorder_point_check",
      sql`${table.reorderPoint} >= 0`,
    ),
    check(
      "branch_product_settings_offline_buffer_check",
      sql`${table.offlineStockBuffer} >= 0`,
    ),
  ],
);

export const productMedia = pgTable(
  "product_media",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productId: ulidColumn("product_id").notNull(),
    productSkuId: ulidColumn("product_sku_id"),
    mediaObjectId: ulidColumn("media_object_id")
      .notNull()
      .references(() => mediaObjects.id, { onDelete: "restrict" }),
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
    uniqueIndex("product_media_product_object_unique")
      .on(table.tenantId, table.productId, table.mediaObjectId)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("product_media_product_primary_unique")
      .on(table.tenantId, table.productId)
      .where(
        sql`${table.deletedAt} is null and ${table.productSkuId} is null and ${table.isPrimary} = true`,
      ),
    uniqueIndex("product_media_sku_primary_unique")
      .on(table.tenantId, table.productSkuId)
      .where(
        sql`${table.deletedAt} is null and ${table.productSkuId} is not null and ${table.isPrimary} = true`,
      ),
    foreignKey({
      name: "product_media_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "product_media_tenant_product_sku_fk",
      columns: [table.tenantId, table.productId, table.productSkuId],
      foreignColumns: [
        productSkus.tenantId,
        productSkus.productId,
        productSkus.id,
      ],
    }).onDelete("restrict"),
    index("product_media_media_object_id_idx").on(table.mediaObjectId),
    index("product_media_deleted_at_idx").on(table.deletedAt),
  ],
);
