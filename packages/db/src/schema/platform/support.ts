import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";

export const feedbackTicketStatusEnum = pgEnum("feedback_ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const feedbackTickets = pgTable(
  "feedback_tickets",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: feedbackTicketStatusEnum("status").notNull().default("open"),
    priority: varchar("priority", { length: 32 }).notNull().default("normal"),
    source: varchar("source", { length: 80 }),
    reporterUserId: ulidColumn("reporter_user_id").references(() => users.id),
    assigneeUserId: ulidColumn("assignee_user_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("feedback_tickets_tenant_id_idx").on(table.tenantId),
    index("feedback_tickets_branch_id_idx").on(table.branchId),
    index("feedback_tickets_status_idx").on(table.status),
    index("feedback_tickets_assignee_user_id_idx").on(table.assigneeUserId),
    index("feedback_tickets_created_at_idx").on(table.createdAt),
  ],
);
