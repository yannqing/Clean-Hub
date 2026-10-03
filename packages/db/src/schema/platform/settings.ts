import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
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
    /** Shown to tenants while maintenance is on; a generic notice when null. */
    maintenanceMessage: text("maintenance_message"),
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

export type PlatformTaxTemplateRate = {
  /** Stable across display-name and rate changes; legacy rows receive a positional key. */
  key?: string;
  name: string;
  /** Fraction configured by a SaaS administrator. */
  rate: string;
  isDefault: boolean;
  /** Optional additive taxes on the same taxable base (their rates sum to rate). */
  components?: Array<{ name: string; rate: string }>;
};

/**
 * A country's tax setup, applied to a tenant when it is created in that
 * country: the default rate, whether shelf prices include tax, and the named
 * rates (standard, reduced, exempt) the owner can assign to services and
 * products. The owner can change all of it afterwards; this only saves them
 * from starting with a blank, untaxed store.
 */
export const platformTaxTemplates = pgTable(
  "platform_tax_templates",
  {
    id: ulidPrimaryKey(),
    /** ISO 3166-1 alpha-2, upper case. */
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    currencyCode: varchar("currency_code", { length: 3 }),
    taxLabel: varchar("tax_label", { length: 80 }),
    exemptionNotes: text("exemption_notes"),
    taxEnabled: boolean("tax_enabled").notNull().default(true),
    pricesIncludeTax: boolean("prices_include_tax").notNull().default(true),
    rates: jsonb("rates").$type<PlatformTaxTemplateRate[]>().notNull(),
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
    uniqueIndex("platform_tax_templates_country_unique").on(table.countryCode),
    check(
      "platform_tax_templates_country_code_check",
      sql`${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "platform_tax_templates_rates_array_check",
      sql`jsonb_typeof(${table.rates}) = 'array'`,
    ),
  ],
);
