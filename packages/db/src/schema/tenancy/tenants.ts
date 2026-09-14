import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "disabled",
]);

export const tenantPilotStatusEnum = pgEnum("tenant_pilot_status", [
  "pilot",
  "live",
  "paused",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: ulidPrimaryKey(),
    name: text("name").notNull(),
    pressingCode: text("pressing_code").notNull().unique(),
    status: tenantStatusEnum("status").notNull().default("active"),
    country: varchar("country", { length: 80 }),
    city: varchar("city", { length: 120 }),
    contactName: varchar("contact_name", { length: 120 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /**
     * Mirrors the soft-delete pair used across the rest of the schema.
     *
     * Declared without `.references(() => users.id)`: `users.tenantId` already
     * points back here, and a Drizzle-level reference in both directions makes
     * the two table types circular (TS7022). The foreign keys are created and
     * enforced in the migration instead.
     */
    deletedBy: ulidColumn("deleted_by"),
    /**
     * Offboarding: the tenant has left, but their data is kept for a retention
     * window so the decision stays reversible and an export can still be taken.
     *
     * `purgeAfter` is when the cleanup job may physically delete the data.
     * Until then the tenant is hidden from the normal list but restorable.
     */
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    /** FK enforced in the migration; see the note on `deletedBy`. */
    offboardedBy: ulidColumn("offboarded_by"),
    offboardReason: text("offboard_reason"),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("tenants_status_idx").on(table.status),
    index("tenants_deleted_at_idx").on(table.deletedAt),
    // The purge job scans for elapsed retention windows.
    index("tenants_purge_after_idx").on(table.purgeAfter),
  ],
);

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
