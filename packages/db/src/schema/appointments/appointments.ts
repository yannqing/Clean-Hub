import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { customers } from "../commerce/customer.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";

export const appointmentTypeEnum = pgEnum("appointment_type", [
  "pickup",
  "dropoff",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "accepted",
  "cancelled",
  "done",
]);

export const appointments = pgTable(
  "appointments",
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
    type: appointmentTypeEnum("type").notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    expectedAt: timestamp("expected_at", { withTimezone: true }).notNull(),
    address: text("address").notNull(),
    notes: text("notes"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
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
    index("appointments_tenant_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.status,
    ),
    index("appointments_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
    index("appointments_expected_at_idx").on(table.expectedAt),
    index("appointments_deleted_at_idx").on(table.deletedAt),
  ],
);
