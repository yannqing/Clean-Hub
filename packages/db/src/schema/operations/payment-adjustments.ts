import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import {
  orders,
  paymentTransactions,
} from "../commerce/orders.js";
import { customers } from "../commerce/customer.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";

export const posPaymentAdjustmentTypeEnum = pgEnum(
  "pos_payment_adjustment_type",
  ["refund", "correction"],
);

export const posPaymentAdjustmentDirectionEnum = pgEnum(
  "pos_payment_adjustment_direction",
  ["debit", "credit"],
);

export const posPaymentAdjustments = pgTable(
  "pos_payment_adjustments",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: ulidColumn("customer_id").references(() => customers.id),
    orderId: ulidColumn("order_id")
      .notNull()
      .references(() => orders.id),
    originalPaymentId: ulidColumn("original_payment_id").references(
      () => paymentTransactions.id,
    ),
    adjustmentType: posPaymentAdjustmentTypeEnum("adjustment_type").notNull(),
    direction: posPaymentAdjustmentDirectionEnum("direction").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
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
    uniqueIndex("pos_payment_adjustments_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("pos_payment_adjustments_order_occurred_at_idx").on(
      table.tenantId,
      table.orderId,
      table.occurredAt,
    ),
    index("pos_payment_adjustments_original_payment_idx").on(
      table.originalPaymentId,
    ),
    index("pos_payment_adjustments_branch_occurred_at_idx").on(
      table.tenantId,
      table.branchId,
      table.occurredAt,
    ),
  ],
);
