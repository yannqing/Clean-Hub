import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { catalogItemStatusEnum } from "../catalog/services.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { tenants } from "../tenancy/tenants.js";

export const hardwareDeviceTypeEnum = pgEnum("hardware_device_type", [
  "printer",
  "scanner",
  "cash_drawer",
]);

export const hardwareConnectionTypeEnum = pgEnum("hardware_connection_type", [
  "usb",
  "bluetooth",
  "network",
  "other",
]);

export const hardwareConfigs = pgTable(
  "hardware_configs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    deviceType: hardwareDeviceTypeEnum("device_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    connectionType: hardwareConnectionTypeEnum("connection_type").notNull(),
    config: jsonb("config")
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    status: catalogItemStatusEnum("status").notNull().default("active"),
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
    index("hardware_configs_tenant_id_idx").on(table.tenantId),
    index("hardware_configs_branch_id_idx").on(table.branchId),
    index("hardware_configs_status_idx").on(table.status),
    index("hardware_configs_deleted_at_idx").on(table.deletedAt),
  ],
);
