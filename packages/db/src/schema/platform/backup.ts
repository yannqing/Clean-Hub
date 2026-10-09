import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";

export const backupJobStatusEnum = pgEnum("backup_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const backupScopeEnum = pgEnum("backup_scope", [
  "platform",
  "tenant",
]);

export const restoreRequestStatusEnum = pgEnum("restore_request_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
  "cancelled",
]);

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
