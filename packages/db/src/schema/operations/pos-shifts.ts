import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { branches } from "../tenancy/branches.js";
import { posTerminalSettings } from "../tenancy/pos-terminal-settings.js";
import { tenants } from "../tenancy/tenants.js";

export const posShiftStatusEnum = pgEnum("pos_shift_status", [
  "open",
  "on_break",
  "closed",
]);

export const posShiftCashMovementTypeEnum = pgEnum(
  "pos_shift_cash_movement_type",
  ["pay_in", "pay_out"],
);

export const posZReportCorrectionTypeEnum = pgEnum(
  "pos_z_report_correction_type",
  ["cash_adjustment", "payment_adjustment", "note"],
);

export type PosZReportPaymentBreakdown = Array<{
  method: string;
  provider?: string | null;
  grossAmount: string;
  refundAmount: string;
  netAmount: string;
  transactionCount: number;
}>;

export const posStaffShifts = pgTable(
  "pos_staff_shifts",
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
    staffId: ulidColumn("staff_id")
      .notNull()
      .references(() => users.id),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    status: posShiftStatusEnum("status").notNull().default("open"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    openingFloat: numeric("opening_float", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    closingFloat: numeric("closing_float", { precision: 12, scale: 2 }),
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
    uniqueIndex("pos_staff_shifts_staff_open_unique")
      .on(table.tenantId, table.staffId)
      .where(sql`${table.status} <> 'closed'`),
    uniqueIndex("pos_staff_shifts_terminal_open_unique")
      .on(table.tenantId, table.terminalId)
      .where(sql`${table.status} <> 'closed'`),
    index("pos_staff_shifts_branch_started_at_idx").on(
      table.tenantId,
      table.branchId,
      table.startedAt,
    ),
    index("pos_staff_shifts_status_idx").on(table.status),
  ],
);

export const posShiftCashMovements = pgTable(
  "pos_shift_cash_movements",
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
    shiftId: ulidColumn("shift_id")
      .notNull()
      .references(() => posStaffShifts.id),
    movementType: posShiftCashMovementTypeEnum("movement_type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("pos_shift_cash_movements_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("pos_shift_cash_movements_shift_created_at_idx").on(
      table.tenantId,
      table.shiftId,
      table.createdAt,
    ),
    check(
      "pos_shift_cash_movements_amount_positive_check",
      sql`${table.amount} > 0`,
    ),
  ],
);

export const posShiftHandovers = pgTable(
  "pos_shift_handovers",
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
    outgoingShiftId: ulidColumn("outgoing_shift_id")
      .notNull()
      .references(() => posStaffShifts.id),
    outgoingStaffId: ulidColumn("outgoing_staff_id")
      .notNull()
      .references(() => users.id),
    incomingStaffId: ulidColumn("incoming_staff_id")
      .notNull()
      .references(() => users.id),
    expectedCash: numeric("expected_cash", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    countedCash: numeric("counted_cash", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    variance: numeric("variance", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    outstandingOrders: integer("outstanding_orders").notNull().default(0),
    outstandingTickets: integer("outstanding_tickets").notNull().default(0),
    notes: text("notes"),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("pos_shift_handovers_outgoing_shift_unique").on(
      table.outgoingShiftId,
    ),
    index("pos_shift_handovers_branch_created_at_idx").on(
      table.tenantId,
      table.branchId,
      table.createdAt,
    ),
  ],
);

export const posZReports = pgTable(
  "pos_z_reports",
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
    shiftId: ulidColumn("shift_id")
      .notNull()
      .references(() => posStaffShifts.id),
    handoverId: ulidColumn("handover_id")
      .notNull()
      .references(() => posShiftHandovers.id),
    currency: varchar("currency", { length: 3 }).notNull().default("XOF"),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
    orderCount: integer("order_count").notNull().default(0),
    grossSales: numeric("gross_sales", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    correctionAmount: numeric("correction_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    unsettledPaymentCount: integer("unsettled_payment_count")
      .notNull()
      .default(0),
    unsettledPaymentAmount: numeric("unsettled_payment_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    unsettledRefundCount: integer("unsettled_refund_count")
      .notNull()
      .default(0),
    unsettledRefundAmount: numeric("unsettled_refund_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    netSales: numeric("net_sales", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    expectedCash: numeric("expected_cash", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    countedCash: numeric("counted_cash", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    variance: numeric("variance", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    outstandingOrders: integer("outstanding_orders").notNull().default(0),
    paymentBreakdown: jsonb("payment_breakdown")
      .$type<PosZReportPaymentBreakdown>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("pos_z_reports_shift_unique").on(table.shiftId),
    uniqueIndex("pos_z_reports_handover_unique").on(table.handoverId),
    index("pos_z_reports_branch_cutoff_idx").on(
      table.tenantId,
      table.branchId,
      table.cutoffAt,
    ),
  ],
);

export const posZReportCorrections = pgTable(
  "pos_z_report_corrections",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: ulidColumn("branch_id")
      .notNull()
      .references(() => branches.id),
    zReportId: ulidColumn("z_report_id")
      .notNull()
      .references(() => posZReports.id),
    correctionType: posZReportCorrectionTypeEnum("correction_type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index("pos_z_report_corrections_report_created_at_idx").on(
      table.zReportId,
      table.createdAt,
    ),
    index("pos_z_report_corrections_tenant_branch_idx").on(
      table.tenantId,
      table.branchId,
    ),
  ],
);
