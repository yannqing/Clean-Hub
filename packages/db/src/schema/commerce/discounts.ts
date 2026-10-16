import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { productCategories, products } from "../catalog/products.js";
import { serviceCategories, services } from "../catalog/services.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { customers } from "./customer.js";
import { orderItems, orders } from "./orders.js";

export const discountMethodEnum = pgEnum("discount_method", [
  "code",
  "automatic",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "amount_off_items",
  "buy_x_get_y",
  "amount_off_order",
  "free_shipping",
]);

export const discountValueTypeEnum = pgEnum("discount_value_type", [
  "percentage",
  "fixed_amount",
  "free",
]);

export const discountEligibilityEnum = pgEnum("discount_eligibility", [
  "all_customers",
  "specific_customers",
]);

export const discountMinimumRequirementEnum = pgEnum(
  "discount_minimum_requirement",
  ["none", "minimum_amount", "minimum_quantity"],
);

export const discountPurchaseRequirementEnum = pgEnum(
  "discount_purchase_requirement",
  ["minimum_amount", "minimum_quantity"],
);

export const discountTargetRoleEnum = pgEnum("discount_target_role", [
  "applies_to",
  "customer_buys",
  "customer_gets",
]);

export const discountTargetTypeEnum = pgEnum("discount_target_type", [
  "product",
  "product_category",
  "service",
  "service_category",
]);

export const discountCountryScopeEnum = pgEnum("discount_country_scope", [
  "all",
  "selected",
]);

export const discountApplicationStatusEnum = pgEnum(
  "discount_application_status",
  ["applied", "voided"],
);

export const discounts = pgTable(
  "discounts",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    title: varchar("title", { length: 200 }).notNull(),
    method: discountMethodEnum("method").notNull(),
    type: discountTypeEnum("type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    valueType: discountValueTypeEnum("value_type"),
    valueAmount: numeric("value_amount", {
      precision: 14,
      scale: 2,
    }),
    currency: varchar("currency", { length: 3 }),
    eligibility: discountEligibilityEnum("eligibility")
      .notNull()
      .default("all_customers"),
    minimumRequirement: discountMinimumRequirementEnum("minimum_requirement")
      .notNull()
      .default("none"),
    minimumPurchaseAmount: numeric("minimum_purchase_amount", {
      precision: 14,
      scale: 2,
    }),
    minimumQuantity: numeric("minimum_quantity", {
      precision: 14,
      scale: 3,
    }),
    usageLimit: integer("usage_limit"),
    oncePerCustomer: boolean("once_per_customer").notNull().default(false),
    combinesWithItemDiscounts: boolean("combines_with_item_discounts")
      .notNull()
      .default(false),
    combinesWithOrderDiscounts: boolean("combines_with_order_discounts")
      .notNull()
      .default(false),
    combinesWithShippingDiscounts: boolean("combines_with_shipping_discounts")
      .notNull()
      .default(false),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allBranches: boolean("all_branches").notNull().default(true),
    posEnabled: boolean("pos_enabled").notNull().default(true),
    customerMobileEnabled: boolean("customer_mobile_enabled")
      .notNull()
      .default(false),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
    buyRequirementType: discountPurchaseRequirementEnum("buy_requirement_type"),
    buyRequirementValue: numeric("buy_requirement_value", {
      precision: 14,
      scale: 3,
    }),
    getQuantity: numeric("get_quantity", {
      precision: 14,
      scale: 3,
    }),
    maxUsesPerOrder: integer("max_uses_per_order"),
    countryScope: discountCountryScopeEnum("country_scope")
      .notNull()
      .default("all"),
    countryCodes: jsonb("country_codes")
      .$type<string[]>()
      .notNull()
      .default([]),
    maximumShippingPrice: numeric("maximum_shipping_price", {
      precision: 14,
      scale: 2,
    }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
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
    uniqueIndex("discounts_tenant_id_id_unique").on(table.tenantId, table.id),
    index("discounts_tenant_type_idx").on(table.tenantId, table.type),
    index("discounts_tenant_method_idx").on(table.tenantId, table.method),
    index("discounts_tenant_enabled_dates_idx").on(
      table.tenantId,
      table.enabled,
      table.startsAt,
      table.endsAt,
    ),
    index("discounts_deleted_at_idx").on(table.deletedAt),
    check(
      "discounts_title_not_blank_check",
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      "discounts_value_configuration_check",
      sql`(
        ${table.type} in ('amount_off_items', 'amount_off_order')
        and ${table.valueType} in ('percentage', 'fixed_amount')
        and ${table.valueAmount} > 0
      ) or (
        ${table.type} = 'buy_x_get_y'
        and ${table.valueType} in ('percentage', 'fixed_amount', 'free')
        and (
          (${table.valueType} = 'free' and ${table.valueAmount} is null)
          or (${table.valueType} <> 'free' and ${table.valueAmount} > 0)
        )
      ) or (
        ${table.type} = 'free_shipping'
        and ${table.valueType} = 'free'
        and ${table.valueAmount} is null
      )`,
    ),
    check(
      "discounts_percentage_value_check",
      sql`${table.valueType} <> 'percentage'
        or ${table.valueAmount} between 0.01 and 100`,
    ),
    check(
      "discounts_currency_configuration_check",
      sql`(
        ${table.valueType} = 'fixed_amount'
        or ${table.minimumRequirement} = 'minimum_amount'
        or ${table.buyRequirementType} = 'minimum_amount'
        or ${table.maximumShippingPrice} is not null
      ) = (${table.currency} is not null)`,
    ),
    check(
      "discounts_minimum_configuration_check",
      sql`(
        ${table.minimumRequirement} = 'none'
        and ${table.minimumPurchaseAmount} is null
        and ${table.minimumQuantity} is null
      ) or (
        ${table.minimumRequirement} = 'minimum_amount'
        and ${table.minimumPurchaseAmount} > 0
        and ${table.minimumQuantity} is null
      ) or (
        ${table.minimumRequirement} = 'minimum_quantity'
        and ${table.minimumQuantity} > 0
        and ${table.minimumPurchaseAmount} is null
      )`,
    ),
    check(
      "discounts_buy_configuration_check",
      sql`(
        ${table.type} <> 'buy_x_get_y'
        and ${table.buyRequirementType} is null
        and ${table.buyRequirementValue} is null
        and ${table.getQuantity} is null
        and ${table.maxUsesPerOrder} is null
      ) or (
        ${table.type} = 'buy_x_get_y'
        and ${table.buyRequirementType} is not null
        and ${table.buyRequirementValue} > 0
        and ${table.getQuantity} > 0
        and (${table.maxUsesPerOrder} is null or ${table.maxUsesPerOrder} > 0)
      )`,
    ),
    check(
      "discounts_shipping_configuration_check",
      sql`(
        ${table.type} = 'free_shipping'
        and (${table.maximumShippingPrice} is null or ${table.maximumShippingPrice} > 0)
      ) or (
        ${table.type} <> 'free_shipping'
        and ${table.countryScope} = 'all'
        and jsonb_array_length(${table.countryCodes}) = 0
        and ${table.maximumShippingPrice} is null
      )`,
    ),
    check(
      "discounts_country_codes_array_check",
      sql`jsonb_typeof(${table.countryCodes}) = 'array'
        and (
          ${table.countryScope} = 'all'
          or jsonb_array_length(${table.countryCodes}) > 0
        )`,
    ),
    check(
      "discounts_tags_array_check",
      sql`jsonb_typeof(${table.tags}) = 'array'`,
    ),
    check(
      "discounts_usage_limit_check",
      sql`${table.usageLimit} is null or ${table.usageLimit} > 0`,
    ),
    check(
      "discounts_date_range_check",
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    check("discounts_version_check", sql`${table.version} >= 1`),
  ],
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    discountId: ulidColumn("discount_id").notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("discount_codes_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("discount_codes_tenant_code_unique")
      .on(table.tenantId, sql`lower(${table.code})`)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("discount_codes_discount_active_unique")
      .on(table.tenantId, table.discountId)
      .where(sql`${table.deletedAt} is null`),
    foreignKey({
      name: "discount_codes_tenant_discount_fk",
      columns: [table.tenantId, table.discountId],
      foreignColumns: [discounts.tenantId, discounts.id],
    }).onDelete("cascade"),
    index("discount_codes_discount_id_idx").on(table.discountId),
    check(
      "discount_codes_code_not_blank_check",
      sql`length(btrim(${table.code})) > 0`,
    ),
  ],
);

export const discountBranches = pgTable(
  "discount_branches",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    discountId: ulidColumn("discount_id").notNull(),
    branchId: ulidColumn("branch_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("discount_branches_scope_unique").on(
      table.tenantId,
      table.discountId,
      table.branchId,
    ),
    foreignKey({
      name: "discount_branches_tenant_discount_fk",
      columns: [table.tenantId, table.discountId],
      foreignColumns: [discounts.tenantId, discounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "discount_branches_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    index("discount_branches_branch_id_idx").on(table.branchId),
  ],
);

export const discountTargets = pgTable(
  "discount_targets",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    discountId: ulidColumn("discount_id").notNull(),
    role: discountTargetRoleEnum("role").notNull(),
    targetType: discountTargetTypeEnum("target_type").notNull(),
    productId: ulidColumn("product_id"),
    productCategoryId: ulidColumn("product_category_id"),
    serviceId: ulidColumn("service_id"),
    serviceCategoryId: ulidColumn("service_category_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    foreignKey({
      name: "discount_targets_tenant_discount_fk",
      columns: [table.tenantId, table.discountId],
      foreignColumns: [discounts.tenantId, discounts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "discount_targets_tenant_product_fk",
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "discount_targets_tenant_product_category_fk",
      columns: [table.tenantId, table.productCategoryId],
      foreignColumns: [productCategories.tenantId, productCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "discount_targets_tenant_service_fk",
      columns: [table.tenantId, table.serviceId],
      foreignColumns: [services.tenantId, services.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "discount_targets_tenant_service_category_fk",
      columns: [table.tenantId, table.serviceCategoryId],
      foreignColumns: [serviceCategories.tenantId, serviceCategories.id],
    }).onDelete("restrict"),
    uniqueIndex("discount_targets_product_unique")
      .on(table.tenantId, table.discountId, table.role, table.productId)
      .where(sql`${table.targetType} = 'product'`),
    uniqueIndex("discount_targets_product_category_unique")
      .on(table.tenantId, table.discountId, table.role, table.productCategoryId)
      .where(sql`${table.targetType} = 'product_category'`),
    uniqueIndex("discount_targets_service_unique")
      .on(table.tenantId, table.discountId, table.role, table.serviceId)
      .where(sql`${table.targetType} = 'service'`),
    uniqueIndex("discount_targets_service_category_unique")
      .on(table.tenantId, table.discountId, table.role, table.serviceCategoryId)
      .where(sql`${table.targetType} = 'service_category'`),
    index("discount_targets_discount_id_idx").on(table.discountId),
    check(
      "discount_targets_reference_check",
      sql`(
        ${table.targetType} = 'product'
        and ${table.productId} is not null
        and ${table.productCategoryId} is null
        and ${table.serviceId} is null
        and ${table.serviceCategoryId} is null
      ) or (
        ${table.targetType} = 'product_category'
        and ${table.productId} is null
        and ${table.productCategoryId} is not null
        and ${table.serviceId} is null
        and ${table.serviceCategoryId} is null
      ) or (
        ${table.targetType} = 'service'
        and ${table.productId} is null
        and ${table.productCategoryId} is null
        and ${table.serviceId} is not null
        and ${table.serviceCategoryId} is null
      ) or (
        ${table.targetType} = 'service_category'
        and ${table.productId} is null
        and ${table.productCategoryId} is null
        and ${table.serviceId} is null
        and ${table.serviceCategoryId} is not null
      )`,
    ),
  ],
);

export const discountCustomers = pgTable(
  "discount_customers",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    discountId: ulidColumn("discount_id").notNull(),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("discount_customers_scope_unique").on(
      table.tenantId,
      table.discountId,
      table.customerId,
    ),
    foreignKey({
      name: "discount_customers_tenant_discount_fk",
      columns: [table.tenantId, table.discountId],
      foreignColumns: [discounts.tenantId, discounts.id],
    }).onDelete("cascade"),
    index("discount_customers_customer_id_idx").on(table.customerId),
  ],
);

export const orderDiscountApplications = pgTable(
  "order_discount_applications",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id),
    customerId: ulidColumn("customer_id").references(() => customers.id),
    discountId: ulidColumn("discount_id")
      .notNull()
      .references(() => discounts.id),
    discountCodeId: ulidColumn("discount_code_id").references(
      () => discountCodes.id,
    ),
    titleSnapshot: varchar("title_snapshot", { length: 200 }).notNull(),
    codeSnapshot: varchar("code_snapshot", { length: 100 }),
    methodSnapshot: discountMethodEnum("method_snapshot").notNull(),
    typeSnapshot: discountTypeEnum("type_snapshot").notNull(),
    valueTypeSnapshot: discountValueTypeEnum("value_type_snapshot"),
    valueAmountSnapshot: numeric("value_amount_snapshot", {
      precision: 14,
      scale: 2,
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: discountApplicationStatusEnum("status")
      .notNull()
      .default("applied"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdBy: ulidColumn("created_by").references(() => users.id),
    voidedBy: ulidColumn("voided_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("order_discount_applications_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("order_discount_applications_active_unique")
      .on(table.tenantId, table.orderId, table.discountId)
      .where(sql`${table.status} = 'applied'`),
    uniqueIndex("order_discount_applications_idempotency_unique")
      .on(table.tenantId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    index("order_discount_applications_order_id_idx").on(table.orderId),
    index("order_discount_applications_discount_id_idx").on(table.discountId),
    index("order_discount_applications_customer_id_idx").on(table.customerId),
    index("order_discount_applications_applied_at_idx").on(table.appliedAt),
    check("order_discount_applications_amount_check", sql`${table.amount} > 0`),
    check(
      "order_discount_applications_status_check",
      sql`(
        ${table.status} = 'applied'
        and ${table.voidedAt} is null
        and ${table.voidReason} is null
        and ${table.voidedBy} is null
      ) or (
        ${table.status} = 'voided'
        and ${table.voidedAt} is not null
        and ${table.voidReason} is not null
      )`,
    ),
  ],
);

export const orderDiscountIdempotencyReceipts = pgTable(
  "order_discount_idempotency_receipts",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    applicationId: ulidColumn("application_id").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    intentKind: varchar("intent_kind", { length: 20 }).notNull(),
    intentValue: varchar("intent_value", { length: 100 }).notNull(),
    reasonSnapshot: text("reason_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("order_discount_idempotency_receipts_tenant_key_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "order_discount_idempotency_receipts_application_fk",
      columns: [table.tenantId, table.applicationId],
      foreignColumns: [
        orderDiscountApplications.tenantId,
        orderDiscountApplications.id,
      ],
    }).onDelete("cascade"),
    index("order_discount_idempotency_receipts_application_idx").on(
      table.applicationId,
    ),
    check(
      "order_discount_idempotency_receipts_intent_kind_check",
      sql`${table.intentKind} in ('code', 'discount_id')`,
    ),
    check(
      "order_discount_idempotency_receipts_intent_value_check",
      sql`length(btrim(${table.intentValue})) > 0`,
    ),
    check(
      "order_discount_idempotency_receipts_reason_check",
      sql`${table.reasonSnapshot} is null
        or length(btrim(${table.reasonSnapshot})) > 0`,
    ),
  ],
);

export const orderDiscountAllocations = pgTable(
  "order_discount_allocations",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    applicationId: ulidColumn("application_id").notNull(),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: ulidColumn("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("order_discount_allocations_application_item_unique").on(
      table.tenantId,
      table.applicationId,
      table.orderItemId,
    ),
    foreignKey({
      name: "order_discount_allocations_tenant_application_fk",
      columns: [table.tenantId, table.applicationId],
      foreignColumns: [
        orderDiscountApplications.tenantId,
        orderDiscountApplications.id,
      ],
    }).onDelete("cascade"),
    index("order_discount_allocations_order_id_idx").on(table.orderId),
    index("order_discount_allocations_order_item_id_idx").on(table.orderItemId),
    check("order_discount_allocations_amount_check", sql`${table.amount} > 0`),
  ],
);
