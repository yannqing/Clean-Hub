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

import { businessLineEnum, services } from "../catalog/services.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import { customers } from "../commerce/customer.js";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "draft",
  "pending",
  "in_progress",
  "ready_to_pick",
  "picked_up",
  "cancelled",
  "exception",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "normal",
  "urgent",
  "critical",
]);

export const ticketSourceChannelEnum = pgEnum("ticket_source_channel", [
  "pos",
  "app",
  "phone",
  "whatsapp",
]);

export const ticketItemTypeEnum = pgEnum("ticket_item_type", [
  "cloth",
  "car",
  "shoe",
  "carpet",
]);

export const ticketItemStatusEnum = pgEnum("ticket_item_status", [
  "washing",
  "done",
  "ready_to_pick",
]);

export const serviceTickets = pgTable(
  "service_tickets",
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
    assistantId: ulidColumn("assistant_id").references(() => users.id),
    ticketNo: varchar("ticket_no", { length: 32 }),
    ticketType: businessLineEnum("ticket_type").notNull(),
    ticketStatus: ticketStatusEnum("ticket_status")
      .notNull()
      .default("draft"),
    expectedPickupAt: timestamp("expected_pickup_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    remark: text("remark"),
    sourceChannel: ticketSourceChannelEnum("source_channel")
      .notNull()
      .default("pos"),
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
    uniqueIndex("service_tickets_tenant_ticket_no_unique").on(
      table.tenantId,
      table.ticketNo,
    ),
    index("service_tickets_tenant_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.ticketStatus,
    ),
    index("service_tickets_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
    index("service_tickets_status_expected_pickup_idx").on(
      table.tenantId,
      table.ticketStatus,
      table.expectedPickupAt,
    ),
  ],
);

export const ticketItems = pgTable(
  "ticket_items",
  {
    id: ulidPrimaryKey(),
    ticketId: ulidColumn("ticket_id")
      .notNull()
      .references(() => serviceTickets.id, { onDelete: "cascade" }),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    serviceId: ulidColumn("service_id").references(() => services.id),
    itemType: ticketItemTypeEnum("item_type"),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    itemCategory: varchar("item_category", { length: 80 }),
    itemStatus: ticketItemStatusEnum("item_status").notNull().default("washing"),
    itemColor: varchar("item_color", { length: 40 }),
    itemBrand: varchar("item_brand", { length: 80 }),
    itemMaterial: varchar("item_material", { length: 80 }),
    quantity: integer("quantity").notNull().default(1),
    unitAmount: numeric("unit_amount", { precision: 12, scale: 2 }).notNull(),
    lineAmount: numeric("line_amount", { precision: 12, scale: 2 }).notNull(),
    remark: text("remark"),
    defectNotes: text("defect_notes"),
    specialRequest: text("special_request"),
    labelCode: varchar("label_code", { length: 64 }),
    sortOrder: integer("sort_order").notNull().default(0),
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
    uniqueIndex("ticket_items_tenant_label_code_unique").on(
      table.tenantId,
      table.labelCode,
    ),
    index("ticket_items_ticket_id_idx").on(table.ticketId),
    index("ticket_items_tenant_id_idx").on(table.tenantId),
    index("ticket_items_service_id_idx").on(table.serviceId),
  ],
);
