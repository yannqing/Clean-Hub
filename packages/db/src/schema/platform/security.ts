import {
  boolean,
  index,
  integer,
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
import { tenants } from "../tenancy/tenants.js";

export const securityEventSeverityEnum = pgEnum("security_event_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const securitySettings = pgTable(
  "security_settings",
  {
    id: ulidPrimaryKey(),
    settingKey: varchar("setting_key", { length: 40 })
      .notNull()
      .default("default"),
    passwordMinLength: integer("password_min_length").notNull().default(8),
    passwordRequiresNumber: boolean("password_requires_number")
      .notNull()
      .default(true),
    passwordRequiresSymbol: boolean("password_requires_symbol")
      .notNull()
      .default(false),
    loginMaxAttempts: integer("login_max_attempts").notNull().default(5),
    lockoutMinutes: integer("lockout_minutes").notNull().default(15),
    refreshTokenDays: integer("refresh_token_days").notNull().default(30),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("security_settings_setting_key_unique").on(table.settingKey),
    index("security_settings_updated_by_idx").on(table.updatedBy),
  ],
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    actorUserId: ulidColumn("actor_user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    severity: securityEventSeverityEnum("severity")
      .notNull()
      .default("medium"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("security_events_tenant_id_idx").on(table.tenantId),
    index("security_events_branch_id_idx").on(table.branchId),
    index("security_events_actor_user_id_idx").on(table.actorUserId),
    index("security_events_event_type_idx").on(table.eventType),
    index("security_events_severity_idx").on(table.severity),
    index("security_events_created_at_idx").on(table.createdAt),
  ],
);
