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
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
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

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "app",
]);

export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  ["pending", "paid", "refunded", "failed"],
);

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
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    orderType: orderTypeEnum("order_type").notNull().default("ticket"),
    status: orderStatusEnum("status").notNull().default("draft"),
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
    index("orders_tenant_id_branch_id_idx").on(table.tenantId, table.branchId),
    index("orders_tenant_id_status_idx").on(table.tenantId, table.status),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_deleted_at_idx").on(table.deletedAt),
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
    sourceType: orderItemSourceTypeEnum("source_type").notNull(),
    sourceId: ulidColumn("source_id").notNull(),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unitAmount: numeric("unit_amount", { precision: 12, scale: 2 }).notNull(),
    lineAmount: numeric("line_amount", { precision: 12, scale: 2 }).notNull(),
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
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_tenant_id_idx").on(table.tenantId),
    index("order_items_ticket_id_idx").on(table.ticketId),
    index("order_items_source_idx").on(table.sourceType, table.sourceId),
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
    paymentStatus: paymentTransactionStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
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
    index("payment_transactions_order_id_idx").on(table.orderId),
    index("payment_transactions_tenant_branch_paid_at_idx").on(
      table.tenantId,
      table.branchId,
      table.paidAt,
    ),
    index("payment_transactions_deleted_at_idx").on(table.deletedAt),
  ],
);
