import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
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
import { orders } from "./orders.js";

export const receiptDeliveryChannelEnum = pgEnum("receipt_delivery_channel", [
  "print",
  "email",
  "sms",
  "none",
]);

export const receiptDeliveryStatusEnum = pgEnum("receipt_delivery_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const receiptDeliveries = pgTable(
  "receipt_deliveries",
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
    channel: receiptDeliveryChannelEnum("channel").notNull(),
    destination: varchar("destination", { length: 320 }),
    status: receiptDeliveryStatusEnum("status").notNull().default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    receiptTitle: varchar("receipt_title", { length: 200 }).notNull(),
    receiptContent: text("receipt_content").notNull(),
    provider: varchar("provider", { length: 80 }),
    externalId: varchar("external_id", { length: 160 }),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("receipt_deliveries_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("receipt_deliveries_order_idx").on(table.tenantId, table.orderId),
    index("receipt_deliveries_pending_idx")
      .on(table.status, table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);
