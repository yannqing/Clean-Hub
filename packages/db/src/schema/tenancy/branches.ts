import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  DEFAULT_POS_RECEIPT_FIELDS,
  DEFAULT_POS_TICKET_LABEL_FIELDS,
  POS_RECEIPT_FIELDS,
  POS_TICKET_LABEL_FIELDS,
  type PosReceiptField,
  type PosTicketLabelField,
} from "@cleanhub/domain/receipt";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { posCashHandlingModeEnum, posPaymentMethodEnum } from "./pos-enums.js";
import { tenants } from "./tenants.js";

export const branchStatusEnum = pgEnum("branch_status", ["active", "inactive"]);

const receiptFieldArraySql = (fields: readonly PosReceiptField[]) =>
  sql.raw(`ARRAY[${fields.map((field) => `'${field}'`).join(", ")}]::text[]`);

const ticketLabelFieldArraySql = (fields: readonly PosTicketLabelField[]) =>
  sql.raw(`ARRAY[${fields.map((field) => `'${field}'`).join(", ")}]::text[]`);

export const branches = pgTable(
  "branches",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: varchar("name", { length: 200 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 32 }),
    businessHours: jsonb("business_hours").$type<Record<string, unknown>>(),
    defaultLanguage: varchar("default_language", { length: 16 })
      .notNull()
      .default("en"),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("XOF"),
    receiptName: varchar("receipt_name", { length: 200 }),
    receiptPhone: varchar("receipt_phone", { length: 32 }),
    receiptAddress: text("receipt_address"),
    receiptThankYouMessage: text("receipt_thank_you_message"),
    receiptFields: text("receipt_fields")
      .array()
      .$type<PosReceiptField[]>()
      .notNull()
      .default(receiptFieldArraySql(DEFAULT_POS_RECEIPT_FIELDS)),
    ticketLabelFields: text("ticket_label_fields")
      .array()
      .$type<PosTicketLabelField[]>()
      .notNull()
      .default(ticketLabelFieldArraySql(DEFAULT_POS_TICKET_LABEL_FIELDS)),
    logoUrl: text("logo_url"),
    /**
     * Cash and payment policy belongs to the branch: whether a store has a
     * physical drawer is a property of the store, not of the tenant or of an
     * individual terminal.
     */
    paymentMethodsEnabled: posPaymentMethodEnum("payment_methods_enabled")
      .array()
      .notNull()
      .default(sql`ARRAY['cash']::pos_payment_method[]`),
    defaultPaymentMethod: posPaymentMethodEnum("default_payment_method")
      .notNull()
      .default("cash"),
    cashHandlingMode: posCashHandlingModeEnum("cash_handling_mode")
      .notNull()
      .default("shared_drawer"),
    /**
     * Smallest note or coin the till stocks, in major units. Cash totals may be
     * rounded down to a multiple of this at the cashier's discretion, because a
     * drawer with no coin under 5 F CFA cannot make exact change. Electronic
     * payments ignore it: mobile money has no such physical limit. 1 disables
     * the offer.
     */
    cashRoundingStep: integer("cash_rounding_step").notNull().default(1),
    status: branchStatusEnum("status").notNull().default("active"),
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
    uniqueIndex("branches_tenant_id_id_unique").on(table.tenantId, table.id),
    index("branches_tenant_id_idx").on(table.tenantId),
    index("branches_status_idx").on(table.status),
    index("branches_deleted_at_idx").on(table.deletedAt),
    check(
      "branches_receipt_fields_valid_check",
      sql`${table.receiptFields} <@ ${receiptFieldArraySql(POS_RECEIPT_FIELDS)}`,
    ),
    check(
      "branches_receipt_fields_merchant_required_check",
      sql`array_position(${table.receiptFields}, 'merchant_name') is not null`,
    ),
    check(
      "branches_ticket_label_fields_valid_check",
      sql`${table.ticketLabelFields} <@ ${ticketLabelFieldArraySql(POS_TICKET_LABEL_FIELDS)}`,
    ),
    check(
      "branches_ticket_label_fields_ticket_required_check",
      sql`array_position(${table.ticketLabelFields}, 'ticket_number') is not null`,
    ),
    check(
      "branches_ticket_label_fields_item_required_check",
      sql`array_position(${table.ticketLabelFields}, 'item_name') is not null`,
    ),
    check(
      "branches_payment_methods_nonempty_check",
      sql`cardinality(${table.paymentMethodsEnabled}) > 0`,
    ),
    check(
      "branches_default_payment_method_enabled_check",
      sql`${table.defaultPaymentMethod} = any(${table.paymentMethodsEnabled})`,
    ),
  ],
);

export const userBranches = pgTable(
  "user_branches",
  {
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.branchId],
      name: "user_branches_pk",
    }),
    index("user_branches_tenant_id_idx").on(table.tenantId),
    index("user_branches_branch_id_idx").on(table.branchId),
  ],
);
