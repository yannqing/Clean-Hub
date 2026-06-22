import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";

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
