import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { customers } from "../commerce/customer.js";
import { orders } from "../commerce/orders.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { serviceTickets } from "../tickets/service-tickets.js";

export const deliveryTaskTypeEnum = pgEnum("delivery_task_type", [
  "pickup",
  "dropoff",
]);

export const deliveryTaskStatusEnum = pgEnum("delivery_task_status", [
  "pending_dispatch",
  "en_route",
  "arrived",
  "picked_up",
  "delivering",
  "signed",
  "exception",
  "cancelled",
]);

export const deliveryTasks = pgTable(
  "delivery_tasks",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    assigneeUserId: ulidColumn("assignee_user_id").references(() => users.id),
    customerId: ulidColumn("customer_id")
      .notNull()
      .references(() => customers.id),
    orderId: ulidColumn("order_id").references(() => orders.id),
    ticketId: ulidColumn("ticket_id").references(() => serviceTickets.id),
    type: deliveryTaskTypeEnum("type").notNull(),
    status: deliveryTaskStatusEnum("status")
      .notNull()
      .default("pending_dispatch"),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }),
    address: text("address").notNull(),
    notes: text("notes"),
    exceptionReason: text("exception_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    exceptionAt: timestamp("exception_at", { withTimezone: true }),
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
    index("delivery_tasks_tenant_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.status,
    ),
    index("delivery_tasks_assignee_status_idx").on(
      table.assigneeUserId,
      table.status,
    ),
    index("delivery_tasks_tenant_assignee_expected_idx").on(
      table.tenantId,
      table.assigneeUserId,
      table.expectedAt,
    ),
    index("delivery_tasks_customer_id_idx").on(table.customerId),
    index("delivery_tasks_order_id_idx").on(table.orderId),
    index("delivery_tasks_ticket_id_idx").on(table.ticketId),
    index("delivery_tasks_deleted_at_idx").on(table.deletedAt),
  ],
);
