import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "./branches.js";
import { tenants } from "./tenants.js";

export const posPaymentMethodEnum = pgEnum("pos_payment_method", [
  "cash",
  "card",
  "app",
]);

export const posRoundingRuleEnum = pgEnum("pos_rounding_rule", [
  "none",
  "round_yuan",
  "round_jiao",
]);

export const posTerminalStatusEnum = pgEnum("pos_terminal_status", [
  "active",
  "inactive",
]);

export const posTerminalSettings = pgTable(
  "pos_terminal_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    label: varchar("label", { length: 64 }),
    defaultPaymentMethod: posPaymentMethodEnum("default_payment_method")
      .notNull()
      .default("cash"),
    roundingRule: posRoundingRuleEnum("rounding_rule")
      .notNull()
      .default("none"),
    autoPrintReceipt: boolean("auto_print_receipt").notNull().default(true),
    printCopies: smallint("print_copies").notNull().default(1),
    lockTimeoutSeconds: integer("lock_timeout_seconds").notNull().default(300),
    status: posTerminalStatusEnum("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("pos_terminal_settings_tenant_device_unique").on(
      table.tenantId,
      table.deviceId,
    ),
    index("pos_terminal_settings_tenant_id_idx").on(table.tenantId),
    index("pos_terminal_settings_branch_id_idx").on(table.branchId),
    index("pos_terminal_settings_status_idx").on(table.status),
  ],
);
