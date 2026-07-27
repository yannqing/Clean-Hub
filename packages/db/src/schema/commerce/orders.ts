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
import { sql } from "drizzle-orm";

import { productPrices, productSkus } from "../catalog/products.js";
import { pricingUnitEnum, services } from "../catalog/services.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { customerAccounts } from "./customer-accounts.js";
import { customers } from "./customer.js";

export const orderTypeEnum = pgEnum("order_type", ["ticket", "manual"]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "received",
  "paid",
  "delivered",
  "cancelled",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "unpaid",
  "paid",
  "partial",
  "refunded",
]);

export const orderItemSourceTypeEnum = pgEnum("order_item_source_type", [
  "ticket_item",
  "subscription",
  "delivery_fee",
  "product",
]);

export const orderItemKindEnum = pgEnum("order_item_kind", [
  "service",
  "product",
  "subscription",
  "delivery_fee",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "app",
]);

export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  ["pending", "paid", "refunded", "failed"],
);

export const paymentInitiatorTypeEnum = pgEnum("payment_initiator_type", [
  "staff",
  "customer",
]);

export const paymentCallbackProcessingStatusEnum = pgEnum(
  "payment_callback_processing_status",
  ["received", "processed", "rejected", "failed"],
);

export const refundRequestStatusEnum = pgEnum("refund_request_status", [
  "pending",
  "approved",
  "processing",
  "rejected",
  "refunded",
  "failed",
]);

export const orders = pgTable(
  "orders",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    orderType: orderTypeEnum("order_type").notNull().default("ticket"),
    status: orderStatusEnum("status").notNull().default("draft"),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    paymentStatus: orderPaymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expireAt: timestamp("expire_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("orders_tenant_id_id_unique").on(table.tenantId, table.id),
    index("orders_tenant_id_branch_id_idx").on(table.tenantId, table.branchId),
    index("orders_tenant_id_status_idx").on(table.tenantId, table.status),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_deleted_at_idx").on(table.deletedAt),
    check(
      "orders_amounts_check",
      sql`${table.subtotalAmount} >= 0
        and ${table.discountAmount} >= 0
        and ${table.discountAmount} <= ${table.subtotalAmount}
        and ${table.totalAmount} = ${table.subtotalAmount} - ${table.discountAmount}`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: ulidPrimaryKey(),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    ticketId: ulidColumn("ticket_id"),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    itemKind: orderItemKindEnum("item_kind").notNull().default("service"),
    sourceType: orderItemSourceTypeEnum("source_type").notNull(),
    sourceId: ulidColumn("source_id").notNull(),
    serviceId: ulidColumn("service_id").references(() => services.id),
    productSkuId: ulidColumn("product_sku_id"),
    productPriceId: ulidColumn("product_price_id"),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 80 }),
    barcodeSnapshot: varchar("barcode_snapshot", { length: 80 }),
    variantNameSnapshot: varchar("variant_name_snapshot", { length: 160 }),
    unitOfMeasureSnapshot: varchar("unit_of_measure_snapshot", { length: 32 }),
    unitCostAmount: numeric("unit_cost_amount", {
      precision: 14,
      scale: 4,
    }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    pricingUnit: pricingUnitEnum("pricing_unit"),
    standardUnitAmount: numeric("standard_unit_amount", {
      precision: 12,
      scale: 2,
    }),
    chargedUnitAmount: numeric("charged_unit_amount", {
      precision: 12,
      scale: 2,
    }),
    weight: numeric("weight", { precision: 10, scale: 3 }),
    bagCount: integer("bag_count"),
    unitAmount: numeric("unit_amount", { precision: 12, scale: 2 }).notNull(),
    lineAmount: numeric("line_amount", { precision: 12, scale: 2 }).notNull(),
    itemColor: varchar("item_color", { length: 40 }),
    defectNotes: text("defect_notes"),
    specialRequest: text("special_request"),
    itemIdentifier: varchar("item_identifier", { length: 64 }),
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
    uniqueIndex("order_items_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      name: "order_items_tenant_product_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "order_items_tenant_product_price_fk",
      columns: [table.tenantId, table.productSkuId, table.productPriceId],
      foreignColumns: [
        productPrices.tenantId,
        productPrices.productSkuId,
        productPrices.id,
      ],
    }).onDelete("restrict"),
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_tenant_id_idx").on(table.tenantId),
    index("order_items_ticket_id_idx").on(table.ticketId),
    index("order_items_service_id_idx").on(table.serviceId),
    index("order_items_product_sku_id_idx").on(table.productSkuId),
    index("order_items_source_idx").on(table.sourceType, table.sourceId),
    check(
      "order_items_product_reference_check",
      sql`(
        ${table.itemKind} = 'product'
        and ${table.productSkuId} is not null
        and ${table.serviceId} is null
        and ${table.ticketId} is null
      ) or (
        ${table.itemKind} <> 'product'
        and ${table.productSkuId} is null
        and ${table.productPriceId} is null
      )`,
    ),
    check(
      "order_items_unit_cost_nonnegative_check",
      sql`${table.unitCostAmount} is null or ${table.unitCostAmount} >= 0`,
    ),
  ],
);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    paymentStatus: paymentTransactionStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }),
    initiatorType: paymentInitiatorTypeEnum("initiator_type")
      .notNull()
      .default("staff"),
    gateway: varchar("gateway", { length: 80 }),
    externalId: varchar("external_id", { length: 120 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
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
    uniqueIndex("payment_transactions_tenant_idempotency_key_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("payment_transactions_order_id_idx").on(table.orderId),
    uniqueIndex("payment_transactions_tenant_gateway_external_id_unique")
      .on(table.tenantId, table.gateway, table.externalId)
      .where(
        sql`${table.deletedAt} is null and ${table.gateway} is not null and ${table.gateway} <> '' and ${table.externalId} is not null and ${table.externalId} <> ''`,
      ),
    index("payment_transactions_tenant_branch_paid_at_idx").on(
      table.tenantId,
      table.branchId,
      table.paidAt,
    ),
    index("payment_transactions_deleted_at_idx").on(table.deletedAt),
  ],
);

export const paymentCallbacks = pgTable(
  "payment_callbacks",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    gateway: varchar("gateway", { length: 80 }).notNull(),
    externalId: varchar("external_id", { length: 120 }).notNull(),
    event: varchar("event", { length: 120 }).notNull(),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    rawPayload: jsonb("raw_payload").notNull().$type<Record<string, unknown>>(),
    processingStatus: paymentCallbackProcessingStatusEnum("processing_status")
      .notNull()
      .default("received"),
    failureReason: text("failure_reason"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_callbacks_gateway_external_event_unique")
      .on(table.gateway, table.externalId, table.event)
      .where(sql`${table.signatureVerified} = true`),
    index("payment_callbacks_tenant_id_idx").on(table.tenantId),
    index("payment_callbacks_status_created_at_idx").on(
      table.processingStatus,
      table.createdAt,
    ),
  ],
);

export const refundRequests = pgTable(
  "refund_requests",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id),
    paymentTransactionId: ulidColumn("payment_transaction_id").references(
      () => paymentTransactions.id,
    ),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    reason: text("reason").notNull(),
    status: refundRequestStatusEnum("status").notNull().default("pending"),
    gateway: varchar("gateway", { length: 80 }),
    externalId: varchar("external_id", { length: 120 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: ulidColumn("approved_by").references(() => users.id),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: ulidColumn("rejected_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("refund_requests_active_order_unique")
      .on(table.tenantId, table.orderId)
      .where(
        sql`${table.deletedAt} is null and ${table.status} in ('pending', 'processing')`,
      ),
    index("refund_requests_tenant_status_idx").on(table.tenantId, table.status),
    index("refund_requests_order_id_idx").on(table.orderId),
    index("refund_requests_payment_transaction_id_idx").on(
      table.paymentTransactionId,
    ),
    index("refund_requests_gateway_external_id_idx").on(
      table.gateway,
      table.externalId,
    ),
    index("refund_requests_deleted_at_idx").on(table.deletedAt),
  ],
);
