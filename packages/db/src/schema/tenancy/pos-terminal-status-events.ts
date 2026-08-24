import { sql } from "drizzle-orm";
import {
  check,
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
import { branches } from "./branches.js";
import { posTerminalSettings } from "./pos-terminal-settings.js";
import { tenants } from "./tenants.js";

export const posTerminalStatusEventTypeEnum = pgEnum(
  "pos_terminal_status_event_type",
  [
    "connected",
    "disconnected",
    "sync_started",
    "sync_completed",
    "sync_error",
    "sync_recovered",
  ],
);

export const posTerminalOperationalStatusEnum = pgEnum(
  "pos_terminal_operational_status",
  [
    "unknown",
    "connecting",
    "online",
    "degraded",
    "synchronizing",
    "offline_pending",
    "offline",
    "sync_error",
    "disabled",
    "never_seen",
  ],
);

export const posTerminalStatusEvents = pgTable(
  "pos_terminal_status_events",
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
    eventType: posTerminalStatusEventTypeEnum("event_type").notNull(),
    fromStatus: posTerminalOperationalStatusEnum("from_status"),
    toStatus: posTerminalOperationalStatusEnum("to_status").notNull(),
    connectionId: varchar("connection_id", { length: 26 }),
    pendingSalesCount: integer("pending_sales_count"),
    pendingOperationsCount: integer("pending_operations_count"),
    errorCode: varchar("error_code", { length: 128 }),
    errorMessage: text("error_message"),
    reason: varchar("reason", { length: 64 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pos_terminal_status_events_tenant_occurred_idx").on(
      table.tenantId,
      table.occurredAt,
    ),
    index("pos_terminal_status_events_terminal_occurred_idx").on(
      table.terminalId,
      table.occurredAt,
    ),
    index("pos_terminal_status_events_branch_occurred_idx").on(
      table.branchId,
      table.occurredAt,
    ),
    check(
      "pos_terminal_status_events_pending_sales_check",
      sql`${table.pendingSalesCount} is null or ${table.pendingSalesCount} >= 0`,
    ),
    check(
      "pos_terminal_status_events_pending_operations_check",
      sql`${table.pendingOperationsCount} is null or ${table.pendingOperationsCount} >= 0`,
    ),
  ],
);
