import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { orders } from "../commerce/orders.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";
import {
  serviceTickets,
  ticketPriorityEnum,
} from "./service-tickets.js";

/**
 * Fulfilment context an order borrowed from the service tickets it settles.
 *
 * One order may settle items from several tickets (a customer collecting one
 * batch while dropping off another), so the link is a table rather than a
 * column on `orders`.
 *
 * The `_snapshot` columns record what the ticket said at checkout, following
 * the same rule as the tax snapshots on `orders`: an order is a financial
 * record, so what it displays must not drift when the ticket is edited or
 * cancelled afterwards. The `ticket_id` foreign key stays for navigation.
 */
export const orderTicketReferences = pgTable(
  "order_ticket_references",
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
      .references(() => orders.id, { onDelete: "cascade" }),
    ticketId: ulidColumn("ticket_id")
      .notNull()
      .references(() => serviceTickets.id),
    ticketNoSnapshot: varchar("ticket_no_snapshot", { length: 32 }),
    ticketRemarkSnapshot: text("ticket_remark_snapshot"),
    prioritySnapshot: ticketPriorityEnum("priority_snapshot")
      .notNull()
      .default("normal"),
    expectedPickupAtSnapshot: timestamp("expected_pickup_at_snapshot", {
      withTimezone: true,
    }),
    assistantNameSnapshot: varchar("assistant_name_snapshot", { length: 120 }),
    itemCount: integer("item_count").notNull().default(0),
    itemAmount: numeric("item_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("order_ticket_references_order_ticket_unique").on(
      table.orderId,
      table.ticketId,
    ),
    index("order_ticket_references_order_id_idx").on(table.orderId),
    index("order_ticket_references_ticket_id_idx").on(table.ticketId),
    index("order_ticket_references_tenant_id_idx").on(table.tenantId),
  ],
);
