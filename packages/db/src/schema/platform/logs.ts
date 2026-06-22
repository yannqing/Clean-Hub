import {
  boolean,
  index,
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

export const operationLogLevelEnum = pgEnum("operation_log_level", [
  "debug",
  "info",
  "warn",
  "error",
]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    actorUserId: ulidColumn("actor_user_id").references(() => users.id),
    eventCategory: varchar("event_category", { length: 80 }).notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: ulidColumn("entity_id"),
    success: boolean("success").notNull().default(true),
    reason: text("reason"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_tenant_id_idx").on(table.tenantId),
    index("audit_logs_branch_id_idx").on(table.branchId),
    index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    index("audit_logs_event_category_idx").on(table.eventCategory),
    index("audit_logs_event_type_idx").on(table.eventType),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const operationLogs = pgTable(
  "operation_logs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    level: operationLogLevelEnum("level").notNull().default("info"),
    service: varchar("service", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    message: text("message").notNull(),
    requestId: varchar("request_id", { length: 120 }),
    actorUserId: ulidColumn("actor_user_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("operation_logs_tenant_id_idx").on(table.tenantId),
    index("operation_logs_branch_id_idx").on(table.branchId),
    index("operation_logs_level_idx").on(table.level),
    index("operation_logs_service_idx").on(table.service),
    index("operation_logs_event_type_idx").on(table.eventType),
    index("operation_logs_created_at_idx").on(table.createdAt),
  ],
);
