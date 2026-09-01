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

import { productSkus } from "../catalog/products.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { customers } from "./customer.js";
import { orderItems, orders } from "./orders.js";

export const salesReturnStatusEnum = pgEnum("sales_return_status", [
  "draft",
  "approved",
  "received",
  "completed",
  "rejected",
  "cancelled",
]);

export const salesReturnItemConditionEnum = pgEnum(
  "sales_return_item_condition",
  ["unopened", "good", "damaged", "defective", "unknown"],
);

export const salesReturnDispositionEnum = pgEnum("sales_return_disposition", [
  "restock",
  "damaged",
  "discarded",
  "exchange",
]);

export const salesReturns = pgTable(
  "sales_returns",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id").notNull(),
    orderId: ulidColumn("order_id").notNull(),
    exchangeOrderId: ulidColumn("exchange_order_id").references(() => orders.id),
    customerId: ulidColumn("customer_id").references(() => customers.id),
    status: salesReturnStatusEnum("status").notNull().default("draft"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    refundAmount: numeric("refund_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    approvedBy: ulidColumn("approved_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("sales_returns_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("sales_returns_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "sales_returns_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "sales_returns_tenant_order_fk",
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }).onDelete("restrict"),
    index("sales_returns_tenant_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.status,
    ),
    index("sales_returns_order_id_idx").on(table.orderId),
    index("sales_returns_exchange_order_id_idx").on(table.exchangeOrderId),
    index("sales_returns_customer_id_idx").on(table.customerId),
    check(
      "sales_returns_refund_amount_nonnegative_check",
      sql`${table.refundAmount} >= 0`,
    ),
  ],
);

export const salesReturnItems = pgTable(
  "sales_return_items",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    salesReturnId: ulidColumn("sales_return_id").notNull(),
    orderItemId: ulidColumn("order_item_id").notNull(),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    condition: salesReturnItemConditionEnum("condition")
      .notNull()
      .default("unknown"),
    disposition: salesReturnDispositionEnum("disposition").notNull(),
    refundAmount: numeric("refund_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("sales_return_items_return_order_item_unique").on(
      table.salesReturnId,
      table.orderItemId,
    ),
    foreignKey({
      name: "sales_return_items_tenant_return_fk",
      columns: [table.tenantId, table.salesReturnId],
      foreignColumns: [salesReturns.tenantId, salesReturns.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "sales_return_items_tenant_order_item_fk",
      columns: [table.tenantId, table.orderItemId],
      foreignColumns: [orderItems.tenantId, orderItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "sales_return_items_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    index("sales_return_items_product_sku_id_idx").on(table.productSkuId),
    index("sales_return_items_order_item_id_idx").on(table.orderItemId),
    check(
      "sales_return_items_quantity_positive_check",
      sql`${table.quantity} > 0`,
    ),
    check(
      "sales_return_items_refund_amount_nonnegative_check",
      sql`${table.refundAmount} >= 0`,
    ),
  ],
);
