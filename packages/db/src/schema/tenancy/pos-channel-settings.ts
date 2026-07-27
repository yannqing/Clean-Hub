import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import {
  posPaymentMethodEnum,
  posRoundingRuleEnum,
} from "./pos-terminal-settings.js";
import { tenants } from "./tenants.js";

export const posChannelSettings = pgTable(
  "pos_channel_settings",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    cashTrackingEnabled: boolean("cash_tracking_enabled")
      .notNull()
      .default(true),
    requireOpeningFloat: boolean("require_opening_float")
      .notNull()
      .default(true),
    requireClosingCount: boolean("require_closing_count")
      .notNull()
      .default(true),
    requireReturnReason: boolean("require_return_reason")
      .notNull()
      .default(true),
    recentCartRetentionHours: smallint("recent_cart_retention_hours")
      .notNull()
      .default(24),
    offlineModeEnabled: boolean("offline_mode_enabled").notNull().default(true),
    syncIntervalSeconds: integer("sync_interval_seconds").notNull().default(60),
    deviceOfflineAfterSeconds: integer("device_offline_after_seconds")
      .notNull()
      .default(600),
    defaultPaymentMethod: posPaymentMethodEnum("default_payment_method")
      .notNull()
      .default("cash"),
    defaultRoundingRule: posRoundingRuleEnum("default_rounding_rule")
      .notNull()
      .default("none"),
    defaultAutoPrintReceipt: boolean("default_auto_print_receipt")
      .notNull()
      .default(true),
    defaultPrintCopies: smallint("default_print_copies").notNull().default(1),
    defaultLockTimeoutSeconds: integer("default_lock_timeout_seconds")
      .notNull()
      .default(300),
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
    uniqueIndex("pos_channel_settings_tenant_id_unique").on(table.tenantId),
    index("pos_channel_settings_updated_by_idx").on(table.updatedBy),
    check(
      "pos_channel_settings_cart_retention_check",
      sql`${table.recentCartRetentionHours} between 1 and 720`,
    ),
    check(
      "pos_channel_settings_sync_interval_check",
      sql`${table.syncIntervalSeconds} between 5 and 3600`,
    ),
    check(
      "pos_channel_settings_offline_threshold_check",
      sql`${table.deviceOfflineAfterSeconds} between (${table.syncIntervalSeconds} * 2) and 86400`,
    ),
    check(
      "pos_channel_settings_print_copies_check",
      sql`${table.defaultPrintCopies} between 1 and 10`,
    ),
    check(
      "pos_channel_settings_lock_timeout_check",
      sql`${table.defaultLockTimeoutSeconds} between 30 and 86400`,
    ),
    check("pos_channel_settings_version_check", sql`${table.version} >= 1`),
  ],
);
