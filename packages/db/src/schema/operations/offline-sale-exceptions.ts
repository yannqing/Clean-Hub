import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
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
import { posTerminalSettings } from "../tenancy/pos-terminal-settings.js";
import { tenants } from "../tenancy/tenants.js";
import {
  posCashDrawerSessions,
  posRegisterSessions,
  posStaffShifts,
} from "./pos-shifts.js";

export const posOfflineSaleExceptionStatusEnum = pgEnum(
  "pos_offline_sale_exception_status",
  ["open", "resolved"],
);

export const posOfflineSaleExceptionResolutionEnum = pgEnum(
  "pos_offline_sale_exception_resolution",
  ["cash_refunded", "recovered"],
);

export const posOfflineSaleExceptions = pgTable(
  "pos_offline_sale_exceptions",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    terminalId: ulidColumn("terminal_id")
      .notNull()
      .references(() => posTerminalSettings.id),
    shiftId: ulidColumn("shift_id")
      .references(() => posStaffShifts.id),
    registerSessionId: ulidColumn("register_session_id").references(
      () => posRegisterSessions.id,
    ),
    cashDrawerSessionId: ulidColumn("cash_drawer_session_id").references(
      () => posCashDrawerSessions.id,
    ),
    staffId: ulidColumn("staff_id")
      .notNull()
      .references(() => users.id),
    commandId: varchar("command_id", { length: 120 }).notNull(),
    orderId: ulidColumn("order_id").notNull(),
    operationType: varchar("operation_type", { length: 24 }).notNull(),
    expectedTotalAmount: numeric("expected_total_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    tenderedAmount: numeric("tendered_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    commandPayload: jsonb("command_payload")
      .$type<Record<string, unknown>>()
      .notNull(),
    failureCode: varchar("failure_code", { length: 80 }),
    failureMessage: text("failure_message").notNull(),
    failureCount: numeric("failure_count", { precision: 8, scale: 0 })
      .notNull()
      .default("1"),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: posOfflineSaleExceptionStatusEnum("status")
      .notNull()
      .default("open"),
    resolution: posOfflineSaleExceptionResolutionEnum("resolution"),
    resolutionReason: text("resolution_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: ulidColumn("resolved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pos_offline_sale_exceptions_tenant_command_unique").on(
      table.tenantId,
      table.commandId,
    ),
    index("pos_offline_sale_exceptions_branch_status_idx").on(
      table.tenantId,
      table.branchId,
      table.status,
      table.createdAt,
    ),
    index("pos_offline_sale_exceptions_order_idx").on(
      table.tenantId,
      table.orderId,
    ),
    check(
      "pos_offline_sale_exceptions_operation_check",
      sql`${table.operationType} in ('checkout', 'payment')`,
    ),
    check(
      "pos_offline_sale_exceptions_amount_check",
      sql`${table.expectedTotalAmount} >= 0 and ${table.tenderedAmount} >= 0`,
    ),
  ],
);
