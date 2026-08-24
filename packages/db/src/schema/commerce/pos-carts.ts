import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { posTerminalSettings } from "../tenancy/pos-terminal-settings.js";
import { tenants } from "../tenancy/tenants.js";
import { orders } from "./orders.js";

export const posCartStatusEnum = pgEnum("pos_cart_status", [
  "active",
  "converted",
  "abandoned",
]);

/**
 * Cloud copy of a POS cart. The JSON payload is validated at the API boundary;
 * authoritative prices, inventory and ticket availability are always resolved
 * again by the backend before preview or checkout.
 */
export const posCarts = pgTable(
  "pos_carts",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    terminalId: ulidColumn("terminal_id")
      .notNull()
      .references(() => posTerminalSettings.id),
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id),
    currency: varchar("currency", { length: 3 }).notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true })
      .notNull(),
    status: posCartStatusEnum("status").notNull().default("active"),
    convertedOrderId: ulidColumn("converted_order_id").references(
      () => orders.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("pos_carts_active_user_branch_unique")
      .on(table.tenantId, table.branchId, table.userId)
      .where(sql`${table.status} = 'active' and ${table.deletedAt} is null`),
    index("pos_carts_tenant_terminal_idx").on(
      table.tenantId,
      table.terminalId,
    ),
    index("pos_carts_expiry_idx").on(table.status, table.expiresAt),
    index("pos_carts_converted_order_idx").on(table.convertedOrderId),
    check("pos_carts_version_check", sql`${table.version} >= 1`),
  ],
);
