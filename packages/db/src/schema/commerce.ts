import {
  date,
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

import { ulidColumn, ulidPrimaryKey } from "./id.js";
import { branches, pricingUnitEnum, services } from "./tenant.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "received",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
]);

export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "unpaid",
  "paid",
  "partial",
  "refunded",
]);

export const customers = pgTable(
  "customers",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("customers_tenant_id_phone_idx").on(table.tenantId, table.phone),
    index("customers_tenant_id_deleted_at_idx").on(
      table.tenantId,
      table.deletedAt,
    ),
  ],
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
    orderNumber: varchar("order_number", { length: 32 }),
    status: orderStatusEnum("status").notNull().default("draft"),
    paymentStatus: orderPaymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    pickupDate: date("pickup_date"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
    deviceId: varchar("device_id", { length: 64 }),
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
    uniqueIndex("orders_tenant_id_order_number_unique").on(
      table.tenantId,
      table.orderNumber,
    ),
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
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: ulidColumn("service_id")
      .notNull()
      .references(() => services.id),
    serviceName: varchar("service_name", { length: 200 }).notNull(),
    pricingUnit: pricingUnitEnum("pricing_unit").notNull().default("per_item"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    lineAmount: numeric("line_amount", { precision: 12, scale: 2 }).notNull(),
    color: text("color"),
    notes: text("notes"),
    defectNotes: text("defect_notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_tenant_id_idx").on(table.tenantId),
    index("order_items_service_id_idx").on(table.serviceId),
  ],
);
