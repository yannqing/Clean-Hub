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

import { ulidColumn, ulidPrimaryKey } from "./id.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const tenantPilotStatusEnum = pgEnum("tenant_pilot_status", [
  "pilot",
  "live",
  "paused",
]);

export const feedbackTicketStatusEnum = pgEnum("feedback_ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const operationLogLevelEnum = pgEnum("operation_log_level", [
  "debug",
  "info",
  "warn",
  "error",
]);

export const backupJobStatusEnum = pgEnum("backup_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const backupScopeEnum = pgEnum("backup_scope", ["platform", "tenant"]);

export const restoreRequestStatusEnum = pgEnum("restore_request_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
  "cancelled",
]);

export const securityEventSeverityEnum = pgEnum("security_event_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    defaultLanguage: varchar("default_language", { length: 16 })
      .notNull()
      .default("en"),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("XOF"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    pilotStatus: tenantPilotStatusEnum("pilot_status")
      .notNull()
      .default("pilot"),
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
    uniqueIndex("tenant_settings_tenant_id_unique").on(table.tenantId),
    index("tenant_settings_updated_by_idx").on(table.updatedBy),
  ],
);

export const tenantFeatureFlags = pgTable(
  "tenant_feature_flags",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    laundryEnabled: boolean("laundry_enabled").notNull().default(true),
    carWashEnabled: boolean("car_wash_enabled").notNull().default(false),
    retailProductsEnabled: boolean("retail_products_enabled")
      .notNull()
      .default(false),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
    notificationsEnabled: boolean("notifications_enabled")
      .notNull()
      .default(true),
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
    uniqueIndex("tenant_feature_flags_tenant_id_unique").on(table.tenantId),
    index("tenant_feature_flags_updated_by_idx").on(table.updatedBy),
  ],
);

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: ulidPrimaryKey(),
    settingKey: varchar("setting_key", { length: 40 })
      .notNull()
      .default("default"),
    defaultLanguage: varchar("default_language", { length: 16 })
      .notNull()
      .default("en"),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("XOF"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
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
    uniqueIndex("platform_settings_setting_key_unique").on(table.settingKey),
    index("platform_settings_updated_by_idx").on(table.updatedBy),
  ],
);

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

export const backupJobs = pgTable(
  "backup_jobs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    scope: backupScopeEnum("scope").notNull().default("tenant"),
    status: backupJobStatusEnum("status").notNull().default("pending"),
    requestedBy: ulidColumn("requested_by").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    resultMetadata: jsonb("result_metadata").$type<Record<string, unknown>>(),
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
    index("backup_jobs_tenant_id_idx").on(table.tenantId),
    index("backup_jobs_scope_idx").on(table.scope),
    index("backup_jobs_status_idx").on(table.status),
    index("backup_jobs_created_at_idx").on(table.createdAt),
  ],
);

export const restoreRequests = pgTable(
  "restore_requests",
  {
    id: ulidPrimaryKey(),
    backupJobId: ulidColumn("backup_job_id").references(() => backupJobs.id),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    requestedBy: ulidColumn("requested_by").references(() => users.id),
    reason: text("reason").notNull(),
    status: restoreRequestStatusEnum("status").notNull().default("pending"),
    reviewedBy: ulidColumn("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
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
    index("restore_requests_backup_job_id_idx").on(table.backupJobId),
    index("restore_requests_tenant_id_idx").on(table.tenantId),
    index("restore_requests_status_idx").on(table.status),
    index("restore_requests_created_at_idx").on(table.createdAt),
  ],
);

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
