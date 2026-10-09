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
import { orderItems, orders } from "../commerce/orders.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { posTerminalSettings } from "../tenancy/pos-terminal-settings.js";
import { tenants } from "../tenancy/tenants.js";

export const inventoryReservationStatusEnum = pgEnum(
  "inventory_reservation_status",
  ["active", "consumed", "released", "expired"],
);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "opening",
  "receipt",
  "sale",
  "sale_return",
  "adjustment_in",
  "adjustment_out",
  "damage",
  "loss",
  "transfer_in",
  "transfer_out",
  "reversal",
]);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id").notNull(),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    onHandQuantity: numeric("on_hand_quantity", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("0"),
    reservedQuantity: numeric("reserved_quantity", {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default("0"),
    averageUnitCost: numeric("average_unit_cost", {
      precision: 14,
      scale: 4,
    }),
    currency: varchar("currency", { length: 3 }),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("inventory_balances_scope_unique").on(
      table.tenantId,
      table.branchId,
      table.productSkuId,
    ),
    foreignKey({
      name: "inventory_balances_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_balances_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    index("inventory_balances_branch_idx").on(table.tenantId, table.branchId),
    index("inventory_balances_product_sku_id_idx").on(table.productSkuId),
    check(
      "inventory_balances_reserved_nonnegative_check",
      sql`${table.reservedQuantity} >= 0`,
    ),
    check(
      "inventory_balances_average_cost_check",
      sql`(${table.averageUnitCost} is null and ${table.currency} is null)
        or (${table.averageUnitCost} >= 0 and ${table.currency} is not null)`,
    ),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id").notNull(),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    orderId: ulidColumn("order_id").notNull(),
    orderItemId: ulidColumn("order_item_id").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    status: inventoryReservationStatusEnum("status")
      .notNull()
      .default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
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
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("inventory_reservations_order_item_unique").on(
      table.tenantId,
      table.orderItemId,
    ),
    foreignKey({
      name: "inventory_reservations_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_reservations_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_reservations_tenant_order_fk",
      columns: [table.tenantId, table.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_reservations_tenant_order_item_fk",
      columns: [table.tenantId, table.orderItemId],
      foreignColumns: [orderItems.tenantId, orderItems.id],
    }).onDelete("restrict"),
    index("inventory_reservations_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.status,
    ),
    index("inventory_reservations_sku_status_idx").on(
      table.tenantId,
      table.productSkuId,
      table.status,
    ),
    index("inventory_reservations_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "inventory_reservations_quantity_positive_check",
      sql`${table.quantity} > 0`,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id").notNull(),
    productSkuId: ulidColumn("product_sku_id").notNull(),
    movementType: inventoryMovementTypeEnum("movement_type").notNull(),
    quantityDelta: numeric("quantity_delta", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    currency: varchar("currency", { length: 3 }),
    referenceType: varchar("reference_type", { length: 40 }).notNull(),
    referenceId: ulidColumn("reference_id"),
    orderItemId: ulidColumn("order_item_id"),
    reversalOfMovementId: ulidColumn("reversal_of_movement_id"),
    terminalId: ulidColumn("terminal_id").references(
      () => posTerminalSettings.id,
    ),
    deviceId: varchar("device_id", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    serverReceivedAt: timestamp("server_received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("inventory_movements_tenant_id_id_unique").on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex("inventory_movements_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "inventory_movements_tenant_branch_fk",
      columns: [table.tenantId, table.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_movements_tenant_sku_fk",
      columns: [table.tenantId, table.productSkuId],
      foreignColumns: [productSkus.tenantId, productSkus.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_movements_tenant_order_item_fk",
      columns: [table.tenantId, table.orderItemId],
      foreignColumns: [orderItems.tenantId, orderItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "inventory_movements_tenant_reversal_fk",
      columns: [table.tenantId, table.reversalOfMovementId],
      foreignColumns: [table.tenantId, table.id],
    }).onDelete("restrict"),
    index("inventory_movements_branch_sku_occurred_idx").on(
      table.tenantId,
      table.branchId,
      table.productSkuId,
      table.occurredAt,
    ),
    index("inventory_movements_reference_idx").on(
      table.tenantId,
      table.referenceType,
      table.referenceId,
    ),
    index("inventory_movements_order_item_id_idx").on(table.orderItemId),
    index("inventory_movements_occurred_at_idx").on(table.occurredAt),
    check(
      "inventory_movements_quantity_nonzero_check",
      sql`${table.quantityDelta} <> 0`,
    ),
    check(
      "inventory_movements_unit_cost_check",
      sql`(${table.unitCost} is null and ${table.currency} is null)
        or (${table.unitCost} >= 0 and ${table.currency} is not null)`,
    ),
    check(
      "inventory_movements_reversal_not_self_check",
      sql`${table.reversalOfMovementId} is null or ${table.reversalOfMovementId} <> ${table.id}`,
    ),
  ],
);
