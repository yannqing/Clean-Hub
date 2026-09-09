import assert from "node:assert/strict";

import {
  posShiftCashMovements,
  posCashDrawerSessions,
  posRegisterSessions,
  posShiftHandovers,
  posStaffShifts,
  posZReports,
} from "@cleanhub/db";
import { getTableConfig } from "drizzle-orm/pg-core";

import { AuthError } from "../../auth/auth.errors.js";
import {
  calculateAdjustmentTotals,
  calculateCashVariance,
  calculateNetSales,
} from "./staff.repository.js";
import {
  assertShiftBranch,
  resolveShiftTransition,
} from "./staff.service.js";
import { PosStaffError } from "./staff.errors.js";
import type { ShiftRecord } from "./staff.types.js";
import {
  clockRequestSchema,
  createHandoverRequestSchema,
  createShiftCashMovementRequestSchema,
} from "./staff.validation.js";

const shiftConfig = getTableConfig(posStaffShifts);
const handoverConfig = getTableConfig(posShiftHandovers);
const reportConfig = getTableConfig(posZReports);
const cashMovementConfig = getTableConfig(posShiftCashMovements);
const registerConfig = getTableConfig(posRegisterSessions);
const cashDrawerConfig = getTableConfig(posCashDrawerSessions);

function uniqueIndexNames(config: ReturnType<typeof getTableConfig>): string[] {
  return config.indexes
    .filter((index) => index.config.unique)
    .map((index) => index.config.name ?? "");
}

assert.ok(
  uniqueIndexNames(shiftConfig).includes("pos_staff_shifts_staff_open_unique"),
  "concurrent clock-in needs a staff-scoped open-shift uniqueness guard",
);
assert.equal(
  uniqueIndexNames(shiftConfig).includes(
    "pos_staff_shifts_terminal_open_unique",
  ),
  false,
  "work shifts must not be owned by a POS terminal",
);
assert.ok(
  uniqueIndexNames(registerConfig).includes(
    "pos_register_sessions_terminal_open_unique",
  ),
  "each terminal needs at most one open register session",
);
assert.ok(
  uniqueIndexNames(cashDrawerConfig).includes(
    "pos_cash_drawer_sessions_shared_register_open_unique",
  ),
  "a shared or assigned drawer needs one open responsibility session",
);
assert.ok(
  uniqueIndexNames(handoverConfig).includes(
    "pos_shift_handovers_outgoing_shift_unique",
  ),
  "a shift may be handed over only once",
);
assert.ok(
  uniqueIndexNames(reportConfig).includes("pos_z_reports_shift_unique"),
  "a shift may produce only one immutable report snapshot",
);
assert.ok(
  uniqueIndexNames(reportConfig).includes("pos_z_reports_handover_unique"),
  "a handover may produce only one immutable report snapshot",
);
assert.ok(
  uniqueIndexNames(reportConfig).includes(
    "pos_z_reports_register_session_unique",
  ),
  "a register session may produce only one immutable Z Report",
);
assert.ok(
  uniqueIndexNames(cashMovementConfig).includes(
    "pos_shift_cash_movements_tenant_idempotency_unique",
  ),
  "cash pay-in/out needs a tenant-scoped idempotency guard",
);
assert.ok(
  reportConfig.columns.some(
    (column) => column.name === "cutoff_at" && column.notNull,
  ),
  "Z Reports must persist a mandatory cutoff",
);
assert.equal(
  reportConfig.columns.some((column) => column.name === "updated_at"),
  false,
  "immutable Z Report snapshots must not expose mutable timestamp state",
);

assert.deepEqual(resolveShiftTransition("break_start", "open"), {
  from: "open",
  to: "on_break",
});
assert.deepEqual(resolveShiftTransition("break_end", "on_break"), {
  from: "on_break",
  to: "open",
});
assert.deepEqual(resolveShiftTransition("clock_out", "open"), {
  from: "open",
  to: "closed",
});
assert.throws(
  () => resolveShiftTransition("break_start", "on_break"),
  (error: unknown) =>
    error instanceof PosStaffError && error.code === "INVALID_SHIFT_ACTION",
);
assert.throws(
  () => resolveShiftTransition("break_end", "open"),
  (error: unknown) =>
    error instanceof PosStaffError && error.code === "INVALID_SHIFT_ACTION",
);

assert.equal(
  clockRequestSchema.safeParse({ action: "clock_in" }).success,
  true,
  "work attendance must not require an opening cash amount",
);
assert.equal(
  clockRequestSchema.safeParse({ action: "clock_out" }).success,
  true,
  "work attendance must not require a closing cash amount",
);
assert.equal(
  clockRequestSchema.safeParse({
    action: "clock_in",
    openingFloat: "100.00",
  }).success,
  false,
  "cash accountability must be recorded on a register, not a work shift",
);
assert.equal(
  createHandoverRequestSchema.safeParse({
    incomingStaffId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    countedCash: "-1.00",
  }).success,
  false,
  "handover counted cash cannot be negative",
);
assert.equal(
  createShiftCashMovementRequestSchema.safeParse({
    movementType: "pay_out",
    amount: "25.00",
    reason: "petty cash purchase",
    idempotencyKey: "cash-movement-1",
  }).success,
  true,
  "a reasoned positive cash pay-out must be accepted",
);

const adjustments = calculateAdjustmentTotals([
  {
    adjustmentType: "refund",
    direction: "debit",
    amount: "25.00",
    method: "cash",
  },
  {
    adjustmentType: "refund",
    direction: "credit",
    amount: "5.00",
    method: "cash",
  },
  {
    adjustmentType: "correction",
    direction: "credit",
    amount: "7.00",
    method: "cash",
  },
  {
    adjustmentType: "correction",
    direction: "debit",
    amount: "2.00",
    method: "card",
  },
]);
assert.deepEqual(adjustments, {
  refundAmount: 20,
  correctionAmount: 5,
  cashAdjustment: -13,
});
assert.equal(calculateCashVariance("97.25", "100.00"), "-2.75");
assert.equal(calculateNetSales("100.00", "10.00"), "90.00");
assert.equal(
  calculateNetSales("100.00", "10.00", "20.00", "5.00"),
  "75.00",
  "refunds and corrections must be reflected in closed net sales",
);

const shift: ShiftRecord = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAZ",
  tenantId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
  terminalId: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
  staffId: "01ARZ3NDEKTSV4RRFFQ69G5FB2",
  currency: "XOF",
  status: "open",
  startedAt: new Date().toISOString(),
  endedAt: null,
  openingFloat: "100.00",
  closingFloat: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};
assert.throws(
  () =>
    assertShiftBranch(shift, {
      branchId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
    }),
  (error: unknown) => error instanceof AuthError && error.code === "FORBIDDEN",
  "cross-branch shift access must fail before mutation",
);
assert.doesNotThrow(
  () =>
    assertShiftBranch(shift, {
      branchId: shift.branchId,
    }),
  "a work shift may be continued from another terminal in the same branch",
);

console.log("POS staff/shift smoke passed.");
