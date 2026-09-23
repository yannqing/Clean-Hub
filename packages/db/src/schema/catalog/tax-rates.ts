import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";

/**
 * A named tax rate a tenant can assign to individual services and products.
 *
 * West African stores sell standard-rated services alongside exempt or
 * reduced-rate lines, so one rate per tenant cannot price a mixed basket
 * correctly. A service or product with no rate assigned falls back to the
 * tenant's default in pos_channel_settings, so tenants that never open this
 * screen keep exactly the behaviour they had.
 *
 * The rate is a fraction -- 0.1800 is 18% -- matching every other stored rate.
 * Rows are archived rather than deleted once assigned, so a historical order
 * line never points at a rate that vanished.
 */
export const taxRates = pgTable(
  "tax_rates",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 80 }).notNull(),
    rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    // Target of the composite foreign keys on services and products, which
    // makes a cross-tenant rate reference impossible at the database level.
    uniqueIndex("tax_rates_tenant_id_id_unique").on(table.tenantId, table.id),
    uniqueIndex("tax_rates_active_name_unique")
      .on(table.tenantId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    index("tax_rates_tenant_order_idx").on(table.tenantId, table.displayOrder),
    check(
      "tax_rates_rate_fraction_check",
      sql`${table.rate} >= 0 and ${table.rate} <= 1`,
    ),
  ],
);
