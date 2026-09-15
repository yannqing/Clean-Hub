import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { catalogItemStatusEnum } from "../catalog/services.js";
import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { posTerminalSettings } from "../tenancy/pos-terminal-settings.js";
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

export const hardwareProvisioningModeEnum = pgEnum(
  "hardware_provisioning_mode",
  ["manual", "built_in"],
);

export const hardwareConfigs = pgTable(
  "hardware_configs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    terminalId: ulidColumn("terminal_id")
      .notNull()
      .references(() => posTerminalSettings.id),
    deviceType: hardwareDeviceTypeEnum("device_type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    connectionType: hardwareConnectionTypeEnum("connection_type").notNull(),
    provisioningMode: hardwareProvisioningModeEnum("provisioning_mode")
      .notNull()
      .default("manual"),
    hardwareKey: varchar("hardware_key", { length: 256 }),
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
    index("hardware_configs_terminal_id_idx").on(table.terminalId),
    index("hardware_configs_status_idx").on(table.status),
    index("hardware_configs_deleted_at_idx").on(table.deletedAt),
    uniqueIndex("hardware_configs_terminal_hardware_key_unique").on(
      table.tenantId,
      table.terminalId,
      table.hardwareKey,
    ),
  ],
);
